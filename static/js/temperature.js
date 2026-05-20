var mode
var warningconst = false
var cputp_data = []
var w24gtp_data = []
var w5gtp_data = []
var data_num = 0;
if (localStorage.getItem("darkMode") == "true") {
    lightmode = "dark"
} else {
    lightmode = "auto"
}
var tp_chart = document.getElementById("tp-chart");
var TpChart = echarts.init(tp_chart, lightmode);
$(document).ready(function() {
    mode = localStorage.getItem('mode') || 1;
    $('.mdui-select').val(mode);
    new mdui.Select('.mdui-select');
});

$('.mdui-select').change(function() {
    if ($(this).val() == 2) {
        $.get(host + '/systemapi/getconfig', function(data) {
            if (data.dev[routernum].routerunit == false) {
                mdui.snackbar({
                    message: '在路由器上运行并打开routerunit模式'
                });
            } else {
                localStorage.setItem('mode', 2);
                mode = 2;
            }
        });
    } else {
        localStorage.setItem('mode', 1);
        mode = 1;
    }
});


function getTp() {
    if (mode == 1) {
        $.get(host + '/routerapi/' + routernum + '/api/misystem/status', function(data) {
            cputp = data.temperature
            w24gtp = 0
            w5gtp = 0
            if (cputp == 0) {
                if (!warningconst) {
                    mdui.snackbar({
                        message: '该设备不支持'
                    });
                }
                warningconst = true

            }
            var table = document.querySelector("table");
            var tbody = document.getElementById("tp-list");
            tbody.innerHTML = "";

            var tr = document.createElement("tr");
            var td_cputp = document.createElement("td");
            td_cputp.textContent = cputp + "°C";
            tr.appendChild(td_cputp);

            var td_fanspeed = document.createElement("td");
            td_fanspeed.textContent = "不支持";
            tr.appendChild(td_fanspeed);

            var td_w24gtp = document.createElement("td");
            td_w24gtp.textContent = "不支持";
            tr.appendChild(td_w24gtp);

            var td_w5gtp = document.createElement("td");
            td_w5gtp.textContent = "不支持";
            tr.appendChild(td_w5gtp);
            //将内容行添加到表格内容区域中
            tbody.appendChild(tr);
            table.appendChild(tbody);
            addData(cputp_data, cputp)
            addData(w24gtp_data, w24gtp)
            addData(w5gtp_data, w5gtp)
            drawTpChart();

        }).fail(function(data) {
            mdui.snackbar({
                message: "请求失败：" + data.msg
            })
        })
    } else if (mode == 2) {
        $.get(host + '/routerapi/' + routernum + '/systemapi/gettemperature', function(data) {

            let cpu_temperature = data.data.cpu
            let fan_speed = data.data.fanspeed
            let w24g_temperature = data.data.w24g
            let w5g_temperature = data.data.w5g
            let table = document.querySelector("table");
            let tbody = document.getElementById("tp-list");
            tbody.innerHTML = "";

            let tr = document.createElement("tr");
            let td_cpu_temperature = document.createElement("td");
            if (data.status.cpu){
                td_cpu_temperature.textContent = cpu_temperature + "°C";
                tr.appendChild(td_cpu_temperature);
            }

            let td_fan_speed = document.createElement("td");
            if (data.status.fanspeed){
                td_fan_speed.textContent = fan_speed + " RPM";
                tr.appendChild(td_fan_speed);
            } else {
                td_fan_speed.textContent = "不支持";
                tr.appendChild(td_fan_speed);
            }

            let td_w24g_temperature = document.createElement("td");
            if (data.status.w24g){
                td_w24g_temperature.textContent = w24g_temperature + "°C";
                tr.appendChild(td_w24g_temperature);
            } else {
                td_w24g_temperature.textContent = "不支持";
                tr.appendChild(td_w24g_temperature);
            }

            let td_w5g_temperature = document.createElement("td");

            if (data.status.w5g){
                td_w5g_temperature.textContent = w5g_temperature + "°C";
                tr.appendChild(td_w5g_temperature);
            } else {
                td_w5g_temperature.textContent = "不支持";
                tr.appendChild(td_w5g_temperature);
            }

            //将内容行添加到表格内容区域中
            tbody.appendChild(tr);
            table.appendChild(tbody);
            addData(cputp_data, cpu_temperature)
            addData(w24gtp_data, w24g_temperature)
            addData(w5gtp_data, w5g_temperature)
            drawTpChart();

        }).fail(function(data) {
            mdui.snackbar({
                message: "请求失败：" + data.msg
            })
        })
    }
}

function drawTpChart() {
    // 定义图表的配置项和数据
    var option = {
        backgroundColor: '',
        tooltip: {
            trigger: "axis",
        },
        legend: {
            orient: 'vertical',
            left: 'right'
        },
        xAxis: {
            type: "category",
            data: cputp_data.map(function(item, index) {
                var data_offset = 0;
                if (data_num > 60) {
                    data_offset = data_num - 60;
                }
                return (index + data_offset + 1) * 5 + "s"; // 返回请求次数作为横坐标
            }),
        },
        yAxis: {
            type: "value",
            name: "温度（°C）",
        },
        series: [{
                name: "CPU",
                type: "line",
                data: cputp_data, 
            },
            {
                name: "2.4g网卡模块",
                type: "line",
                data: w24gtp_data, 
            },
            {
                name: "5g网卡模块",
                type: "line",
                data: w5gtp_data, 
            }
        ],
    };
    TpChart.hideLoading();
    TpChart.setOption(option);
}

window.addEventListener('resize', function() {
    TpChart.resize();
});


$(function() {
    TpChart.showLoading();
    // 初次加载状态
    getTp();
    // 每5秒刷新状态
    setInterval(function() {
        getTp();
    }, pageUpdateTime);
});