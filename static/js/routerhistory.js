if (localStorage.getItem("darkMode") == "true") {
    lightmode = "dark"
} else {
    lightmode = "auto"
}
var xdata = [];
var download_traffic_data = [];
var upload_traffic_data = [];
var cpu_data = [];
var cputp_data = [];
var mem_data = [];
var upspeed_data = [];
var downspeed_data = [];
var devicenum_data = [];

function purgedata() {
    xdata = [];
    cpu_data = [];
    cputp_data = [];
    mem_data = [];
    upspeed_data = [];
    downspeed_data = [];
    devicenum_data = [];
    download_traffic_data = [];
    upload_traffic_data = [];
}
var TrafficChart = echarts.init(document.getElementById("traffic-chart"), lightmode);
var StatusChart = echarts.init(document.getElementById("status-chart"), lightmode);
var SpeedChart = echarts.init(document.getElementById("speed-chart"), lightmode);
var Devicenumchart = echarts.init(document.getElementById("devicenum-chart"), lightmode);

function updateStatus() {
    showChartLoading();
    purgedata();
    $.get(host + '/systemapi/getrouterhistory?routernum=' + routernum, function(data) {
        history_data = data.history
        for (var i = 0; i < history_data.length; i++) {
            time = new Date(history_data[i].CreatedAt).toLocaleString();
            cpuload = history_data[i].Cpu.toFixed(2)
            cpu_tp = history_data[i].Cpu_tp
            memusage = history_data[i].Mem.toFixed(2)
            upspeed = history_data[i].UpSpeed
            downspeed = history_data[i].DownSpeed
            uptotal = history_data[i].UpTotal
            downtotal = history_data[i].DownTotal
            devicenum = history_data[i].DeviceNum
            xdata.push(time)
            cpu_data.push(cpuload)
            cputp_data.push(cpu_tp)
            mem_data.push(memusage)
            upspeed_data.push(convertSize(upspeed,speedUnit))
            downspeed_data.push(convertSize(downspeed,speedUnit))
            upload_traffic_data.push(convertSize(uptotal,trafficUnit))
            download_traffic_data.push(convertSize(downtotal,trafficUnit))
            devicenum_data.push(devicenum)
        }

        drawstatusChart();
        drawspeedChart();
        drawTrafficChart();
        devicenumChart();
    }).fail(function(jqXHR, textStatus, errorThrown) { // 添加HTTP错误处理
        mdui.snackbar({
            message: "请求失败：HTTP " + jqXHR.status + " - " + errorThrown
        });
    });
}


function get_router_name() {
    $.get(host + '/routerapi/' + routernum + '/api/xqsystem/router_name', function(data) {
        router_name = data.routerName
        $("#router_name").text(router_name)
    }).fail(function(jqXHR, textStatus, errorThrown) { // 添加HTTP错误处理
        mdui.snackbar({
            message: "请求失败：HTTP " + jqXHR.status + " - " + errorThrown
        });
    });
}

function get_appconfig() {
    $.get(host + '/systemapi/getconfig', function(data) {
        maxsaved = data.history.maxsaved;
        databasepath = data.history.databasepath;
        sampletime = data.history.sampletime;
        $("#maxsaved").text(maxsaved);
        $("#databasepath").text(databasepath);
        $("#sampletime").text(sampletime);
        // 计算时间跨度
        timespan = convertSeconds(parseInt(sampletime) * parseInt(maxsaved));
        $("#timespan").text(timespan);
    });
}

$(function() {
    // 初次加载状态
    get_appconfig();
    get_router_name();
    updateStatus();
    // 每5秒刷新状态
    // setInterval(function() {
    //     updateStatus();
    // }, pageUpdateTime);
});


function pushuptrafficdata(name, value) {
    data = {
        value: value,
        name: name
    }
    upload_traffic_data.push(data);

}

function pushdowntrafficdata(name, value) {
    data = {
        value: value,
        name: name
    }
    download_traffic_data.push(data);

}

// 定义所有图表的实例数组
echarts.connect([StatusChart, SpeedChart, Devicenumchart]);

function drawTrafficChart() {
    let {result_list: upload_traffic_data_processed, xdata: xdata_processed} = processTrafficData(xdata, upload_traffic_data, classification);
    let download_traffic_data_processed = processTrafficData(xdata, download_traffic_data, classification).result_list;
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
            data: xdata_processed
        },
        yAxis: {
            type: "value",
            name: "（" + trafficUnit + "）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
                name: "上传",
                type: "bar",
                data: upload_traffic_data_processed, 
            },
            {
                name: "下载",
                type: "bar",
                data: download_traffic_data_processed, 
            }
        ],
    };
    TrafficChart.hideLoading();
    TrafficChart.setOption(option);
}

function drawstatusChart() {
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
            data: xdata
        },
        yAxis: {
            type: "value",
            name: "（%）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
                name: "CPU",
                type: "line",
                data: cpu_data,
            },
            {
                name: "内存",
                type: "line",
                data: mem_data,
            },
            {
                name: "CPU温度(°C)",
                type: "line",
                data: cputp_data,
            },
        ],
    };
    StatusChart.hideLoading();
    StatusChart.setOption(option);
}

function drawspeedChart() {
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
            data: xdata
        },
        yAxis: {
            type: "value",
            name: "（" + speedUnit + "）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
                name: "上传速度",
                type: "line",
                data: upspeed_data,
            },
            {
                name: "下载速度",
                type: "line",
                data: downspeed_data,
            },
        ],
    };
    SpeedChart.hideLoading();
    SpeedChart.setOption(option);
}

function devicenumChart() {
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
            data: xdata
        },
        yAxis: {
            type: "value",
            name: "（个）",
        },
        dataZoom: [{
            type: 'slider',
            xAxisIndex: 0,
            filterMode: 'none'
        }],
        series: [{
            name: "已连接设备数量",
            type: "line",
            data: devicenum_data,
        }],
    };
    Devicenumchart.hideLoading();
    Devicenumchart.setOption(option);
}

window.addEventListener('resize', function() {
    TrafficChart.resize();
    StatusChart.resize();
    SpeedChart.resize();
    Devicenumchart.resize();
});


// 展示加载动画
function showChartLoading() {
    TrafficChart.showLoading();
    StatusChart.showLoading();
    SpeedChart.showLoading();
    Devicenumchart.showLoading();
}

$('#data-fit-time-select').val(localStorage.getItem("classification") || "day");
new mdui.Select('#data-fit-time-select')
$('#data-fit-time-select').on('change', function () {
    classification = $(this).val();
    localStorage.setItem('classification', classification);
    drawTrafficChart();
})