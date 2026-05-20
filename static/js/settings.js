// 前端页面配置

$(document).ready(function() {
    $('#data-fit-time-select-settings').val(classification);
    $('#speed-unit-select-settings').val(speedUnit);
    $('#traffic-unit-select-settings').val(trafficUnit);
    $('#language-select-settings').val(language);

    new mdui.Select('#data-fit-time-select-settings')
    new mdui.Select('#speed-unit-select-settings')
    new mdui.Select('#traffic-unit-select-settings')
    new mdui.Select('#language-select-settings')
    
    $('#page-update-time-select-settings').val(pageUpdateTime);


    $('#data-fit-time-select-settings').on('change', function () {
        classification = $(this).val();
        localStorage.setItem('classification', classification);
    })
    $('#speed-unit-select-settings').on('change', function () {
        speedUnit = $(this).val();
        localStorage.setItem('speed-unit', speedUnit);
    }) 
    $('#traffic-unit-select-settings').on('change', function () {
        trafficUnit = $(this).val();
        localStorage.setItem('traffic-unit', trafficUnit);
    })
    $('#language-select-settings').on('change', function () {
        language = $(this).val();
        $("[i18n]").i18n({
            defaultLang: language,
            filePath: "/web/i18n/",
            filePrefix: "i18n_",
            fileSuffix: "",
            forever: true,
            callback: function() {
            }
        });
        
        localStorage.setItem('language', language);
    }) 

    $('#page-update-time-select-settings').on('change', function () {
        pageUpdateTime = $(this).val();
        localStorage.setItem('page-update-time', Number(pageUpdateTime));
    })
    
});

// 检查更新

$("#spinner").hide();

function getbackendversion() {
    $.get(host + '/systemapi/getconfig', function(data) {
        $('#backendversion').text(data.ver)
    });
}
function checkUpdate() {
    $("#update-info").text("正在检查更新...");
    $("#checkUpdate-button").attr("disabled", true);
    $("#spinner").show();
    $.get("https://mrui-api.hzchu.top/v3/api/checkupdate", function(data) {
        let version = document.querySelector('meta[name="version"]').getAttribute('content');
        var frontversion = data.front.version;
        var backendversion = data.backend.version;
        var versioninfo = "";
        var changelog = "";
            // 检查document.getElementById("frontversion")是否一致
        if (version != frontversion) {
            versioninfo += "前端版本有更新，版本号：" + frontversion + "<br>";
            $("#flushFront-button").attr("disabled", false);
        }
        if ($("#backendversion").text() == "Docker") {
            versioninfo += "当前为Docker环境，无法检查后端更新<br>";
        } else if ($("#backendversion").text() != backendversion) {
            versioninfo += "后端版本有更新，版本号：" + backendversion + "<br>";
        }
        if (version == frontversion && $("#backendversion").text() == backendversion) {
            versioninfo += "未检测到更新(●'◡'●)<br>";
        }
        // 处理更新日志
        var frontlog = data.front.changelog_html;
        var backendlog = data.backend.changelog_html;
        if (frontlog) {
            
            changelog += "前端" + frontversion + "版本更新日志:<br>" + frontlog + "<br>";
        }
        if (backendlog) {
            changelog += "<div class='mdui-divider gap'></div>后端" + backendversion + "版本更新日志:<br>" + backendlog + "<br>";
        }
        $("#update-info").html(versioninfo);
        $("#update-log").html(changelog);
        $("#checkUpdate-button").attr("disabled", false);
        $("#spinner").hide();
    })

}

function flushFront() {
    $("#spinner").show();
    $("#flushFront-button").attr("disabled", true);
    $.get(host + '/systemapi/flushstatic', function(data) {
        if (data.code == 0) {
            mdui.snackbar({
                message: "更新成功"
            })
        } else if (data.msg) {
            mdui.snackbar({
                message: data.msg
            });
        } else {
            mdui.snackbar({
                message: data.message
            });
        }
        $("#spinner").hide();
        $("#flushFront-button").attr("disabled", false);
        // 5秒后刷新
        setTimeout(function() {
            location.reload();
        }, pageUpdateTime);
    })
}
$(function() {
    getbackendversion();
});

// 切换后端程序地址
$(document).ready(function() {
    var storedHost = localStorage.getItem('host');
    if (storedHost) {
        var url = new URL(storedHost);
        $('#ip').val(url.hostname);
        $('#port').val(url.port);
    }
});

$('#Form').submit(function(event) {
    event.preventDefault();
    var ip = $('#ip').val();
    var port = $('#port').val();
    var newHost = "http://" + ip + ":" + port;
    localStorage.setItem('host', newHost);
    window.location.href = "/web/";
});