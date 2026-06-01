package login

import (
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/sirupsen/logrus"
)

var (
	token      string
	routername string
	hardware   string
)

func createNonce() string {
	typeVar := 0
	deviceID := "00:e0:4f:27:3d:09" //MAC
	timeVar := int(time.Now().Unix())
	randomVar := rand.Intn(10000)
	return fmt.Sprintf("%d_%s_%d_%d", typeVar, deviceID, timeVar, randomVar)
}

func hashPassword(pwd string, nonce string, key string) string {
	pwdKey := pwd + key
	pwdKeyHash := sha1.New()
	pwdKeyHash.Write([]byte(pwdKey))
	pwdKeyHashStr := fmt.Sprintf("%x", pwdKeyHash.Sum(nil))

	noncePwdKey := nonce + pwdKeyHashStr
	noncePwdKeyHash := sha1.New()
	noncePwdKeyHash.Write([]byte(noncePwdKey))
	noncePwdKeyHashStr := fmt.Sprintf("%x", noncePwdKeyHash.Sum(nil))

	return noncePwdKeyHashStr
}
func newhashPassword(pwd string, nonce string, key string) string {
	pwdKey := pwd + key
	pwdKeyHash := sha256.Sum256([]byte(pwdKey))
	pwdKeyHashStr := hex.EncodeToString(pwdKeyHash[:])

	noncePwdKey := nonce + pwdKeyHashStr
	noncePwdKeyHash := sha256.Sum256([]byte(noncePwdKey))
	noncePwdKeyHashStr := hex.EncodeToString(noncePwdKeyHash[:])

	return noncePwdKeyHashStr
}
func getrouterinfo(ip string) (bool, string, string, error) {
	// 发送 GET 请求，设置 5 秒超时
	ourl := fmt.Sprintf("http://%s/cgi-bin/luci/api/xqsystem/init_info", ip)
	client := &http.Client{Timeout: 5 * time.Second}
	response, err := client.Get(ourl)
	if err != nil {
		return false, "", "", fmt.Errorf("GET init_info failed: %w", err)
	}
	defer response.Body.Close()
	// 读取响应内容
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return false, "", "", fmt.Errorf("read body failed: %w", err)
	}

	// 解析 JSON
	var data map[string]interface{}
	err = json.Unmarshal(body, &data)
	if err != nil {
		return false, "", "", fmt.Errorf("unmarshal init_info failed: %w", err)
	}
	//提取routername
	var routernameStr string
	var hardwareStr string
	if data["routername"] != nil {
		routernameStr = data["routername"].(string)
	}
	if data["hardware"] != nil {
		hardwareStr = data["hardware"].(string)
	}
	logrus.Debug("Router model: " + hardwareStr)
	logrus.Debug("Router name: " + routernameStr)
	// 检查 newEncryptMode
	newEncryptMode, ok := data["newEncryptMode"].(float64)
	if !ok {
		logrus.Debug("Using old encryption mode")
		return false, routernameStr, hardwareStr, nil
	}

	if newEncryptMode != 0 {
		logrus.Debug("Using new encryption mode")
		logrus.Info("The current router may not be able to fetch certain data properly!")
		return true, routernameStr, hardwareStr, nil
	}
	return false, routernameStr, hardwareStr, nil
}

func CheckRouterAvailability(ip string) bool {
	client := http.Client{
		Timeout: 5 * time.Second,
	}

	for i := range 5 {
		_, err := client.Get("http://" + ip)
		if err == nil {
			return true
		}
		logrus.Info("Router " + ip + " is not available, retrying for " + fmt.Sprint(i+1) + " times... Error details:")
		logrus.Info(err)
		time.Sleep(2 * time.Second)
	}

	return false
}

func GetToken(password string, key string, ip string, skipCheck bool) (string, string, string, error) {
	logrus.Debug("Checking router availability...")
	if !skipCheck {
		if !CheckRouterAvailability(ip) {
			return "", "", "", fmt.Errorf("router is not available (check ping failed)")
		}
	} else {
		logrus.Debug("Skipping router availability check.")
	}
	logrus.Debug("Getting router information...")
	newEncryptMode, routername, hardware, err := getrouterinfo(ip)
	if err != nil {
		return "", "", "", fmt.Errorf("getting router info failed: %w", err)
	}
	logrus.Info("Updating token...")
	nonce := createNonce()

	if password == "" {
		logrus.Info("Password is empty, please check configuration")
		time.Sleep(5 * time.Second)
		os.Exit(1)
	}

	var hashedPassword string

	if newEncryptMode {
		hashedPassword = newhashPassword(password, nonce, key)
	} else {
		hashedPassword = hashPassword(password, nonce, key)
	}

	ourl := fmt.Sprintf("http://%s/cgi-bin/luci/api/xqsystem/login", ip)
	params := url.Values{}
	params.Set("username", "admin")
	params.Set("password", hashedPassword)
	params.Set("logtype", "2")
	params.Set("nonce", nonce)

	// 使用带有 5 秒严格超时限制的 http 客户端，防止掉线长久等待堵塞
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.PostForm(ourl, params)
	if err != nil {
		// 🚨 网络掉线或网络不可达，只优雅返回 error，绝不执行 os.Exit 崩溃！
		return "", "", "", fmt.Errorf("login connection error (router might be offline or restarting): %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(body, &result)
	var code int
	if result["code"] != nil {
		code = int(result["code"].(float64))
	} else {
		logrus.Info("Router login request returned empty! Please check configuration")
	}

	if code == 0 {
		logrus.Debug("Current token: " + fmt.Sprint(result["token"]))
		token = result["token"].(string)
	} else {
		// 🚨 100% 保留原有的 os.Exit 强制退出机制，防止密码配置错误导致被路由器拉黑封禁
		logrus.Error("Login failed! Authentication rejected. Please check configuration.")
		logrus.Error("Response: " + string(body))
		logrus.Error("Exiting program in 5 seconds to prevent being banned by the router.")
		time.Sleep(5 * time.Second)
		os.Exit(1)
	}
	return token, routername, hardware, nil
}
