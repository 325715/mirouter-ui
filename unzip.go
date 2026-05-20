package main

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func main() {
	zipFile := "vendor.zip"
	fmt.Println("正在通过 Go 原生引擎解压并重构依赖包:", zipFile)

	r, err := zip.OpenReader(zipFile)
	if err != nil {
		fmt.Printf("无法打开压缩文件: %v\n", err)
		os.Exit(1)
	}
	defer r.Close()

	for _, f := range r.File {
		// 黄金法则：强制将所有反斜杠统一替换为 Linux 目录正斜杠
		fpath := strings.ReplaceAll(f.Name, "\\", "/")

		// 如果是目录或以正斜杠结尾，创建目录
		if f.FileInfo().IsDir() || strings.HasSuffix(fpath, "/") {
			os.MkdirAll(fpath, 0755)
			continue
		}

		// 创建父目录
		if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
			fmt.Printf("创建目录失败 %s: %v\n", filepath.Dir(fpath), err)
			os.Exit(1)
		}

		// 创建并打开目标文件
		outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			fmt.Printf("创建文件失败 %s: %v\n", fpath, err)
			os.Exit(1)
		}

		// 打开压缩包内的文件源
		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			fmt.Printf("读取压缩内容失败 %s: %v\n", f.Name, err)
			os.Exit(1)
		}

		// 拷贝内容
		_, err = io.Copy(outFile, rc)
		outFile.Close()
		rc.Close()
		if err != nil {
			fmt.Printf("写入文件失败 %s: %v\n", fpath, err)
			os.Exit(1)
		}
	}

	fmt.Println("依赖包重构完成，已完美生成标准的 vendor/ 目录！")
}
