package main

import (
	"archive/zip"
	"encoding/json"
	_ "flag"
	"fmt"
	"io"
	"net/http"
	"path/filepath"

	"github.com/Mirouterui/mirouter-ui/modules/config"
	"github.com/Mirouterui/mirouter-ui/modules/database"
	login "github.com/Mirouterui/mirouter-ui/modules/login"
	"github.com/Mirouterui/mirouter-ui/modules/tp"

	// _ "net/http/pprof"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"github.com/shirou/gopsutil/cpu"
	"github.com/sirupsen/logrus"
)

var (
	tokens         map[int]string
	debug          bool
	port           int
	routerNames    map[int]string
	hardwares      map[int]string
	isLocals       map[int]bool
	tiny           bool
	dev            []config.Dev
	workdirectory  string
	Version        string
	databasepath   string
	flushTokenTime int
	maxsaved       int
	historyEnable  bool
	sampletime     int
	safemode       bool
	api_key        string
	address        string
	skipCheck      bool
)

var (
	reconnectMutex    sync.Mutex
	lastReconnectTime time.Time
)

type Config struct {
	Dev          []config.Dev `json:"dev"`
	Debug        bool         `json:"debug"`
	Port         int          `json:"port"`
	Tiny         bool         `json:"tiny"`
	Databasepath string       `json:"databasepath"`
	Address      string       `json:"address"`
}

func init() {
	// 加载配置
	cfg, err := config.LoadConfig()
	if err != nil {
		logrus.Fatal(err)
	}

	dev = cfg.Dev
	debug = cfg.Debug
	port = cfg.Port
	tiny = cfg.Tiny
	maxsaved = cfg.History.MaxDeleted
	historyEnable = cfg.History.Enable
	sampletime = cfg.History.Sampletime
	flushTokenTime = cfg.FlushTokenTime
	workdirectory = cfg.Workdirectory
	databasepath = cfg.Databasepath
	safemode = cfg.SafeMode
	api_key = cfg.ApiKey
	tokens = make(map[int]string)
	routerNames = make(map[int]string)
	hardwares = make(map[int]string)
	isLocals = make(map[int]bool)
	address = cfg.Address
	skipCheck = cfg.SkipCheck
	// go func() {
	// 	logrus.Println(http.ListenAndServe(":6060", nil))
	// }()
}
func GetCpuPercent() float64 {
	percent, _ := cpu.Percent(time.Second, false)
	return percent[0] / 100
}

func getconfig(c *gin.Context) {
	type DevNoPassword struct {
		Key     string `json:"key"`
		IP      string `json:"ip"`
		IsLocal bool   `json:"is_local"`
	}
	type History struct {
		Enable       bool   `json:"enable"`
		MaxDeleted   int    `json:"maxsaved"`
		Databasepath string `json:"databasepath"`
		Sampletime   int    `json:"sampletime"`
	}
	devsNoPassword := []DevNoPassword{}
	for _, d := range dev {
		devNoPassword := DevNoPassword{
			Key:     d.Key,
			IP:      d.IP,
			IsLocal: d.IsLocal,
		}
		devsNoPassword = append(devsNoPassword, devNoPassword)
	}
	history := History{}
	history.Enable = historyEnable
	history.MaxDeleted = maxsaved
	history.Databasepath = databasepath
	history.Sampletime = sampletime
	c.JSON(http.StatusOK, map[string]interface{}{
		"tiny":           tiny,
		"port":           port,
		"debug":          debug,
		"dev":            devsNoPassword,
		"history":        history,
		"flushTokenTime": flushTokenTime,
		"ver":            Version,
	})
}

func gettoken(dev []config.Dev) error {
	var firstErr error
	for i, d := range dev {
		token, routerName, hardware, err := login.GetToken(d.Password, d.Key, d.IP, skipCheck)
		if err != nil {
			logrus.Warnf("获取路由器 %s 登录令牌失败（等待断网重连中）: %v", d.IP, err)
			if firstErr == nil {
				firstErr = err
			}
			tokens[i] = ""
			continue
		}
		tokens[i] = token
		routerNames[i] = routerName
		hardwares[i] = hardware
		isLocals[i] = d.IsLocal
		logrus.Debug(hardwares[i])
	}
	return firstErr
}

func handleRouterAPI(routernum int, apipath string) (map[string]interface{}, error) {
	ip := dev[routernum].IP
	url := fmt.Sprintf("http://%s/cgi-bin/luci/;stok=%s/api/%s", ip, tokens[routernum], apipath)

	// 1. 设置严格的 5 秒超时保护，防止断网长期挂起
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)

	var result map[string]interface{}
	var code int

	if err == nil {
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		json.Unmarshal(body, &result)
		if result["code"] != nil {
			code = int(result["code"].(float64))
		}
	}

	// 2. 检测到网络故障（err != nil）或会话失效（code == 1101 表示 stok 过期）时，触发静默自愈
	if err != nil || code == 1101 {
		// 重连冷却保护：限制 15 秒内只能真正发起 1 次重新登录，防止关机期间的高频尝试
		reconnectMutex.Lock()
		now := time.Now()
		shouldRetry := false
		if now.Sub(lastReconnectTime) > 15*time.Second {
			lastReconnectTime = now
			logrus.Warnf("检测到路由器 %s 连接断开或令牌失效 (code:%d, err:%v)，正在静默尝试登录重连并获取新 stok...", ip, code, err)
			
			// 尝试静默重新登录
			_, _, _, loginErr := login.GetToken(dev[routernum].Password, dev[routernum].Key, ip, skipCheck)
			if loginErr == nil {
				logrus.Info("静默登录重连成功！重新同步全局 Token map")
				gettoken(dev)
				shouldRetry = true
			} else {
				logrus.Warnf("静默登录重连尝试失败（路由器依然离线中）: %v", loginErr)
			}
		}
		reconnectMutex.Unlock()

		// 如果是因为网络连接本身报错，并且经历了上面的尝试仍然不通，就直接返回超时错误
		if err != nil {
			return nil, fmt.Errorf("xiaomi router offline or connection timeout: %w", err)
		}

		// 如果是因为 Token 失效（code == 1101），且刚才静默重连成功了，就自动使用最新 stok 进行【二次重发尝试】
		if code == 1101 && shouldRetry {
			retryUrl := fmt.Sprintf("http://%s/cgi-bin/luci/;stok=%s/api/%s", ip, tokens[routernum], apipath)
			retryResp, retryErr := client.Get(retryUrl)
			if retryErr == nil {
				defer retryResp.Body.Close()
				retryBody, _ := io.ReadAll(retryResp.Body)
				var retryResult map[string]interface{}
				json.Unmarshal(retryBody, &retryResult)
				
				var retryCode int
				if retryResult["code"] != nil {
					retryCode = int(retryResult["code"].(float64))
				}
				if retryCode == 0 {
					logrus.Info("自动无感重试并获取数据成功！")
					if isLocals[routernum] && apipath == "/misystem/status" {
						cpuPercent := GetCpuPercent()
						if cpu, ok := retryResult["cpu"].(map[string]interface{}); ok {
							cpu["load"] = cpuPercent
						}
					}
					return retryResult, nil
				}
			}
		}
	}

	// 正常返回请求结果
	if err != nil {
		return nil, err
	}
	if code != 0 {
		return nil, fmt.Errorf("xiaomi router api response failed with code: %d", code)
	}

	if isLocals[routernum] && apipath == "/misystem/status" {
		cpuPercent := GetCpuPercent()
		if cpu, ok := result["cpu"].(map[string]interface{}); ok {
			cpu["load"] = cpuPercent
		}
	}
	return result, nil
}

func main() {
	// starttime := int(time.Now().Unix())
	logrus.Info("Current backend version: " + Version)

	if !debug {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()

	c := cron.New()

	// 添加 CORS 中间件
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	if !tiny {
		// 检查本地是否存在 static/index.html，如果不存在则自动拉取
		if _, err := os.Stat("static/index.html"); os.IsNotExist(err) {
			logrus.Info("本地未检测到 static/index.html，开始从 https://file.zhya.top/mi-ui-static.zip 自动下载最新静态资源包...")
			err := downloadAndUnzip("https://file.zhya.top/mi-ui-static.zip", "static")
			if err != nil {
				logrus.Fatalf("下载并解压静态资源包失败: %v", err)
			}
			logrus.Info("静态资源包下载并解压成功！")
		}

		// 使用物理磁盘目录进行极速挂载
		r.StaticFS("/web/", http.Dir("static"))

		// 重定向到 /web/
		r.GET("/", func(c *gin.Context) {
			c.Redirect(http.StatusMovedPermanently, "/web/")
		})
	}

	r.GET("/routerapi/:routernum/api/*apipath", func(c *gin.Context) {
		routernum, err := strconv.Atoi(c.Param("routernum"))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"msg": "Parameter error"})
			return
		}
		apipath := c.Param("apipath")
		logrus.Debug(apipath)

		switch apipath {
		case "/xqsystem/router_name":
			c.JSON(http.StatusOK, gin.H{"routerName": routerNames[routernum]})
			return

		case
			"/misystem/status",
			"/misystem/devicelist",
			"/xqsystem/internet_connect",
			"/xqsystem/fac_info",
			"/misystem/messages",
			"/xqsystem/upnp",
			"/xqnetwork/diagdevicelist",
			"/xqsystem/get_location":
			result, err := handleRouterAPI(routernum, apipath)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"msg": err.Error()})
				return
			}
			c.JSON(http.StatusOK, result)
			return

		default:
			if !safemode {
				if c.Query("api_key") == api_key {
					result, err := handleRouterAPI(routernum, apipath)
					if err != nil {
						c.JSON(http.StatusInternalServerError, gin.H{"msg": err.Error()})
						return
					}
					c.JSON(http.StatusOK, result)
					return
				} else {
					c.JSON(http.StatusUnauthorized, gin.H{"msg": "Authentication failed."})
					return
				}
			}
			c.JSON(http.StatusForbidden, gin.H{"msg": "This API needs authentication."})
			return
		}
	})

	r.GET("/routerapi/:routernum/systemapi/gettemperature", func(c *gin.Context) {
		routernum, err := strconv.Atoi(c.Param("routernum"))
		logrus.Debug(tokens)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"msg": "Parameter error"})
			return
		}
		result := tp.GetTemperature(c, routernum, hardwares[routernum], dev)
		if result.Success {
			c.JSON(http.StatusOK, gin.H{
				"data":   result.Data,
				"status": result.Status,
			})
			return
		}
		c.JSON(http.StatusNotImplemented, gin.H{"msg": "This device is not supported"})
	})

	// r.GET("/api/v1/data", func(c *gin.Context) {
	// 	chart := c.Query("chart")
	// 	dimensions := c.Query("dimensions")

	// 	ip := dev[netdata_routernum].IP
	// 	token := tokens[netdata_routernum]
	// 	cpuLoad, memAvailable, _, _, upSpeed, downSpeed, temperature, deviceOnline, _, _ := netdata.ProcessData(ip, token)

	// 	switch chart {
	// 	case "system.cpu":
	// 		if onrouters[netdata_routernum] {
	// 			cpuLoad = int(GetCpuPercent() * 100)
	// 		}
	// 		data := netdata.GenerateArray("system.cpu", cpuLoad, starttime, "system.cpu", "system.cpu")
	// 		c.JSON(http.StatusOK, data)
	// 		return
	// 	case "mem.available":
	// 		data := netdata.GenerateArray("mem.available", memAvailable, starttime, "avail", "MemAvailable")
	// 		c.JSON(http.StatusOK, data)
	// 		return
	// 	case "device.online":
	// 		data := netdata.GenerateArray("device.online", deviceOnline, starttime, "online", "online")
	// 		c.JSON(http.StatusOK, data)
	// 		return
	// 	case "net.eth0":
	// 		if dimensions == "received" {
	// 			data := netdata.GenerateArray("net.eth0", downSpeed, starttime, "received", "received")
	// 			c.JSON(http.StatusOK, data)
	// 			return
	// 		}
	// 		if dimensions == "sent" {
	// 			data := netdata.GenerateArray("net.eth0", -upSpeed, starttime, "sent", "sent")
	// 			c.JSON(http.StatusOK, data)
	// 			return
	// 		}
	// 		c.String(http.StatusOK, "缺失参数")
	// 		return
	// 	case "sensors.temp_thermal_zone0_thermal_thermal_zone0":
	// 		data := netdata.GenerateArray("sensors.temp_thermal_zone0_thermal_thermal_zone0", temperature, starttime, "temperature", "temperature")
	// 		c.JSON(http.StatusOK, data)
	// 		return
	// 	default:
	// 		c.JSON(http.StatusOK, map[string]interface{}{
	// 			"code": 1102,
	// 			"msg":  "该图表数据不支持",
	// 		})
	// 		return
	// 	}
	// })

	r.GET("/systemapi/getconfig", getconfig)

	r.GET("/systemapi/getrouterhistory", func(c *gin.Context) {
		routernum, err := strconv.Atoi(c.Query("routernum"))
		fixupfloat := c.Query("fixupfloat")
		if fixupfloat == "" {
			fixupfloat = "false"
		}
		fixupfloat_bool, err1 := strconv.ParseBool(fixupfloat)
		if err != nil || err1 != nil {
			c.JSON(http.StatusBadRequest, gin.H{"msg": "Parameter error"})
			return
		}
		if !historyEnable {
			c.JSON(http.StatusServiceUnavailable, gin.H{"msg": "History data is not enabled"})
			return
		}
		history := database.GetRouterHistory(databasepath, routernum, fixupfloat_bool)

		c.JSON(http.StatusOK, gin.H{"history": history})
	})

	r.GET("/systemapi/getdevicehistory", func(c *gin.Context) {
		deviceMac := c.Query("devicemac")
		fixupfloat := c.Query("fixupfloat")
		if fixupfloat == "" {
			fixupfloat = "false"
		}
		fixupfloat_bool, err := strconv.ParseBool(fixupfloat)

		if deviceMac == "" || len(deviceMac) != 17 || err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"msg": "Parameter error"})
			return
		}
		if !historyEnable {
			c.JSON(http.StatusServiceUnavailable, gin.H{"msg": "History data is not enabled"})
			return
		}
		history := database.GetDeviceHistory(databasepath, deviceMac, fixupfloat_bool)

		c.JSON(http.StatusOK, gin.H{"history": history})
	})

	r.GET("/systemapi/flushstatic", func(c *gin.Context) {
		if c.Query("api_key") != api_key {
			c.JSON(http.StatusUnauthorized, gin.H{"msg": "Authentication failed"})
			return
		}
		logrus.Info("收到手动刷新静态资源请求，开始重新下载解压...")
		err := downloadAndUnzip("https://file.zhya.top/mi-ui-static.zip", "static")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"msg": "Flush static failed: " + err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"msg": "Static resources flushed successfully"})
	})

	r.GET("/systemapi/refresh", func(c *gin.Context) {
		err := gettoken(dev)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"msg": "Refresh token failed: " + err.Error()})
			return
		}
		logrus.Debugln("Execution completed")
		c.JSON(http.StatusOK, gin.H{"msg": "Execution completed"})
	})

	r.GET("/systemapi/quit", func(c *gin.Context) {
		if c.Query("api_key") != api_key {
			c.JSON(http.StatusUnauthorized, gin.H{"msg": "Authentication failed"})
			return
		}
		go func() {
			time.Sleep(1 * time.Second)
			defer os.Exit(0)
		}()
		c.JSON(http.StatusOK, gin.H{"msg": "Shutting down"})
	})

	// 启动时登录：若网络不通（返回 err），则进入 5 秒一轮的静默重试机制，绝不暴毙！
	for {
		err := gettoken(dev)
		if err == nil {
			logrus.Info("所有配置的路由器登录认证成功，服务顺利拉起！")
			break
		}
		logrus.Warnf("启动时登录失败（可能是路由器离线或网络未畅通），5秒后重新尝试握手... 详情: %v", err)
		time.Sleep(5 * time.Second)
	}

	database.CheckDatabase(databasepath)
	c.AddFunc("@every "+strconv.Itoa(flushTokenTime)+"s", func() { gettoken(dev) })

	if historyEnable {
		c.AddFunc("@every "+strconv.Itoa(sampletime)+"s", func() {
			database.Savetodb(databasepath, dev, tokens, maxsaved)
		})
	}
	c.Start()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		<-quit
		logrus.Info("Server is shutting down...")

		// Stop scheduled task
		c.Stop()

		logrus.Info("Server closed")
		os.Exit(0)
	}()

	r.Run(fmt.Sprintf("%s:%d", address, port))
}

// downloadAndUnzip 从指定的 URL 下载 Zip 资源并解压到目标目录
func downloadAndUnzip(url string, destDir string) error {
	// 1. 创建目标临时文件，用于存储下载的 zip
	tmpFile, err := os.CreateTemp("", "mi-ui-static-*.zip")
	if err != nil {
		return fmt.Errorf("创建临时文件失败: %w", err)
	}
	defer os.Remove(tmpFile.Name())
	defer tmpFile.Close()

	// 2. 发起 HTTP GET 请求下载
	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("请求下载地址失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("下载请求返回非 200 状态码: %d", resp.StatusCode)
	}

	// 3. 写入临时文件
	_, err = io.Copy(tmpFile, resp.Body)
	if err != nil {
		return fmt.Errorf("写入临时文件失败: %w", err)
	}

	// 4. 重置临时文件指针到开头
	_, err = tmpFile.Seek(0, 0)
	if err != nil {
		return fmt.Errorf("重置文件指针失败: %w", err)
	}

	// 5. 获取临时文件大小
	stat, err := tmpFile.Stat()
	if err != nil {
		return fmt.Errorf("获取临时文件状态失败: %w", err)
	}

	// 6. 用 archive/zip 读取并解开到 destDir
	zipReader, err := zip.NewReader(tmpFile, stat.Size())
	if err != nil {
		return fmt.Errorf("读取 zip 文件失败: %w", err)
	}

	// 确保目标目录存在
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("创建目标目录失败: %w", err)
	}

	for _, f := range zipReader.File {
		// 统一处理 Windows 压缩包中的反斜杠 \，替换为标准正斜杠 /
		cleanedName := strings.ReplaceAll(f.Name, "\\", "/")
		
		// 拼接解压后的物理完整路径
		fpath := filepath.Join(destDir, cleanedName)

		// 检查路径安全（防止 Zip Slip 漏洞）
		if !strings.HasPrefix(filepath.Clean(fpath), filepath.Clean(destDir)) {
			continue
		}

		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, 0755)
			continue
		}

		// 创建该文件所在的父级目录
		if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
			return fmt.Errorf("创建文件父目录失败: %w", err)
		}

		// 写入物理文件
		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return fmt.Errorf("创建输出文件失败: %w", err)
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return fmt.Errorf("打开 zip 内文件流失败: %w", err)
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return fmt.Errorf("解压写入文件失败: %w", err)
		}
	}

	return nil
}
