package main

import (
	"archive/zip"
	"bytes"
	_ "embed"
	"encoding/json"
	_ "flag"
	"fmt"
	"io"
	"io/fs"
	"net/http"

	"github.com/Mirouterui/mirouter-ui/modules/config"
	"github.com/Mirouterui/mirouter-ui/modules/database"
	login "github.com/Mirouterui/mirouter-ui/modules/login"
	"github.com/Mirouterui/mirouter-ui/modules/tp"

	// _ "net/http/pprof"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"github.com/shirou/gopsutil/cpu"
	"github.com/sirupsen/logrus"
)

//go:embed static.zip
var staticZipBytes []byte

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

// compatibleZipFS 自定义自适应虚拟文件系统，在运行时自适应正/反斜杠路径寻址
type compatibleZipFS struct {
	r *zip.Reader
}

func (cfs *compatibleZipFS) Open(name string) (fs.File, error) {
	// 1. 首先尝试按标准正斜杠路径打开
	f, err := cfs.r.Open(name)
	if err == nil {
		return f, nil
	}

	// 2. 兼容 Windows 反斜杠格式：将所有的正斜杠 / 替换为 Windows 的反斜杠 \ 再次尝试打开
	winName := strings.ReplaceAll(name, "/", "\\")
	f, err = cfs.r.Open(winName)
	if err == nil {
		return f, nil
	}

	return nil, err
}

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

func gettoken(dev []config.Dev) {
	for i, d := range dev {
		token, routerName, hardware := login.GetToken(d.Password, d.Key, d.IP, skipCheck)
		tokens[i] = token
		routerNames[i] = routerName
		hardwares[i] = hardware
		isLocals[i] = d.IsLocal
		logrus.Debug(hardwares[i])
	}
}

func handleRouterAPI(routernum int, apipath string) (map[string]interface{}, error) {
	ip := dev[routernum].IP
	url := fmt.Sprintf("http://%s/cgi-bin/luci/;stok=%s/api/%s", ip, tokens[routernum], apipath)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("xiaomi router API call failed, please check configuration or router status")
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)

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
		zipReader, err := zip.NewReader(bytes.NewReader(staticZipBytes), int64(len(staticZipBytes)))
		if err != nil {
			logrus.Fatal("Failed to read static zip: ", err)
		}

		// 构建虚拟文件和虚拟目录的内存极速检索索引，同时将 Windows 反斜杠 \ 重构为标准正斜杠 /
		virtualFiles := make(map[string]bool)
		virtualDirs := make(map[string]bool)
		for _, f := range zipReader.File {
			f.Name = strings.ReplaceAll(f.Name, "\\", "/")
			virtualFiles[f.Name] = true

			// 提取所有父级目录，建立目录映射关系
			parts := strings.Split(f.Name, "/")
			for i := 1; i < len(parts); i++ {
				dirPath := strings.Join(parts[:i], "/")
				virtualDirs[dirPath] = true
			}
		}

		// 引入极其健壮的“虚拟文件系统路由中间件”，完美解决虚拟目录 301 重定向与 index.html 自动寻址
		r.Use(func(c *gin.Context) {
			path := c.Request.URL.Path
			if strings.HasPrefix(path, "/web/") {
				relPath := strings.TrimPrefix(path, "/web/")
				relPath = strings.TrimSuffix(relPath, "/")

				if relPath == "" {
					// 访问根目录 /web/ 直接在内部映射到 index.html
					c.Request.URL.Path = "/web/index.html"
					c.Next()
					return
				}

				// 精确匹配虚拟文件直接放行
				if virtualFiles[relPath] {
					c.Next()
					return
				}

				// 匹配虚拟目录
				if virtualDirs[relPath] {
					// 如果路径末尾没有斜杠，执行 301 重定向到带斜杠路径（符合 HTTP 规范，保障资源相对路径正确）
					if !strings.HasSuffix(path, "/") {
						c.Redirect(http.StatusMovedPermanently, path+"/")
						c.Abort()
						return
					}
					// 如果已经有斜杠，内部无缝重写为读取该目录下的 index.html
					c.Request.URL.Path = path + "index.html"
					c.Next()
					return
				}
			}
			c.Next()
		})

		r.StaticFS("/web/", http.FS(&compatibleZipFS{r: zipReader}))
		// 重定向到/web/
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
		c.JSON(http.StatusOK, gin.H{"msg": "Static resources are embedded in the binary and cannot be updated dynamically"})
	})

	r.GET("/systemapi/refresh", func(c *gin.Context) {
		gettoken(dev)
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

	gettoken(dev)

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
