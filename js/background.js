import {State} from "./module/State.js";
import {Util} from "./module/Util.js";
import {DangerType} from "./module/DangerType.js";

let progressRunning = false;
let downLoadingFiles = [], iconCache = {};
if (chrome.downloads && chrome.downloads.setShelfEnabled)
    chrome.downloads.setShelfEnabled(false);

let normalIcon = '/img/icon_gray.png';
let notice = 'off';
let sound = 'off';
let autoResume = false;

changeIcon();

chrome.storage.sync.get(
    {
        iconType: 'auto',
        downloadNotice: false,
        downloadSound: false,
        downloadAutoResume : 'off'
    }, function (obj) {
        let iconType = obj.iconType;
        let icon = '/img/icon_gray.png';
        if (iconType === 'dark') {
            icon = '/img/icon_gray.png';
        } else if (iconType === 'light') {
            icon = '/img/icon_light.png';
        } else {
            if (isDark()) {
                icon = '/img/icon_light.png';
            } else {
                icon = '/img/icon_gray.png';
            }
        }
        normalIcon = icon;
        notice = obj.downloadNotice;
        sound = obj.downloadSound;
        autoResume = 'on' === obj.downloadAutoResume;
        chrome.browserAction.setIcon({path: normalIcon});
    }
);


chrome.runtime.onMessage.addListener(function (request) {
    if (request.method === 'pullProgress') {
        if (!progressRunning){
            pullProgress();
        }
    } else if (request.method === 'cacheIcon') {
        cacheIcon(request.data);
    } else if (request.method === 'deleteIconCache') {
        delete iconCache[request.data];
    } else if (request.method === 'changeIcon') {
        normalIcon = request.data;
        chrome.downloads.search({
            state: State.in_progress.code
        }, function (results) {
            //若没有正在下载的文件，则修改图标
            if (results.length === 0) {
                chrome.browserAction.setIcon({
                    path: normalIcon
                });
            }
        });
    } else if (request.method === 'changeNotice') {
        notice = request.data;
    } else if (request.method === 'changeSound') {
        sound = request.data;
    } else if (request.method === 'changeAutoResume'){
        autoResume = "on" === request.data;
    } else if(request.method === 'resumeTask'){//恢复下载的功能，应该是放在后台执行的
        resumeTask(request.data);
    }
});

chrome.downloads.onCreated.addListener(function (downloadItem) {
    downLoadingFiles.push(downloadItem);
});

chrome.downloads.onChanged.addListener(function (downloadDelta) {
    if (!iconCache.hasOwnProperty(downloadDelta.id) || Util.emptyString(iconCache[downloadDelta.id].icon)) {
        cacheIcon(downloadDelta.id);
    }
    if (downloadDelta.danger && downloadDelta.danger.current !== DangerType.safe.code && downloadDelta.danger.current !== DangerType.accepted.code) {
        cacheIcon(downloadDelta.id, false, function (cachedIcon) {
            if (Array.isArray(notice) && notice.indexOf('danger') !== -1) {
                chrome.notifications.getPermissionLevel(function (level) {
                    if (level === 'granted') {
                        chrome.downloads.search({id: downloadDelta.id}, arr => {
                            if (Array.isArray(arr) && arr.length > 0) {
                                chrome.notifications.create('danger-' + downloadDelta.id, {
                                    type: 'basic',
                                    title: chrome.i18n.getMessage('safetyWaring'),
                                    message: Util.filename(arr[0].filename),
                                    contextMessage: DangerType.valueOf(downloadDelta.danger.current).name,
                                    iconUrl: cachedIcon.icon || '/img/icon_green.png',
                                    isClickable: true
                                }, notificationId => {

                                });

                            }
                        });
                    }
                });
            }
            if (!progressRunning)
                pullProgress();
            chrome.browserAction.setBadgeText({
                text: downLoadingFiles.length + ''
            });
            let downloadItem = downLoadingFiles.find(downloadItem => downloadItem.id === downloadDelta.id);
            if (downloadItem == null)
                return;
            downloadItem.filename = downloadDelta.filename.current;
            chrome.runtime.sendMessage({
                method: 'createDownloadItem',
                data: downloadItem
            });
        });
    } else {
        if (downloadDelta.filename && downloadDelta.filename.current) {
            if (!progressRunning)
                pullProgress();
            chrome.browserAction.setBadgeText({
                text: downLoadingFiles.length + ''
            });
            let downloadItem = downLoadingFiles.find(downloadItem => downloadItem.id === downloadDelta.id);
            if (downloadItem == null)
                return;
            downloadItem.filename = downloadDelta.filename.current;
            chrome.runtime.sendMessage({
                method: 'createDownloadItem',
                data: downloadItem
            });
            if (Array.isArray(notice) && notice.indexOf('start') !== -1) {
                chrome.notifications.create('start-' + downloadDelta.id, {
                    type: 'basic',
                    title: chrome.i18n.getMessage('downloadStart'),
                    message: chrome.i18n.getMessage('downloadStart') + '：' + Util.filename(downloadDelta.filename.current),
                    iconUrl: iconCache[downloadDelta.id] && iconCache[downloadDelta.id].icon || '/img/icon_green.png',
                    isClickable: true
                }, notificationId => {

                });
            }
        }

        if (downloadDelta.state && downloadDelta.state.current === State.complete.code) {
            if (sound === 'on'){
                playSound();
            }

            //下载完成更新图标
            cacheIcon(downloadDelta.id, true, function (cachedIcon) {
                //发送文件下载完成请求
                chrome.runtime.sendMessage({
                    method: 'downloadComplete',
                    data: downloadDelta
                });
                if (Array.isArray(notice) && notice.indexOf('complete') !== -1) {
                    chrome.notifications.getPermissionLevel(function (level) {
                        if (level === 'granted') {
                            chrome.downloads.search({id: downloadDelta.id}, results => {
                                if (Array.isArray(results) && results.length > 0) {
                                    chrome.notifications.create('complete-' + downloadDelta.id, {
                                        type: 'basic',
                                        title: chrome.i18n.getMessage('downloadComplete'),
                                        message: results[0].filename,
                                        iconUrl: cachedIcon.icon || '/img/icon_green.png',
                                        buttons: [{
                                            title: chrome.i18n.getMessage('open'),
                                        }, {
                                            title: chrome.i18n.getMessage('openFolder'),
                                        }],
                                        isClickable: true
                                    }, notificationId => {

                                    });

                                }
                            });
                        }
                    });
                }
            });
            chrome.downloads.search({
                state: State.in_progress.code,
                paused: false
            }, function (results) {
                //若没有正在下载的文件，则把图标改回默认
                if (results.length === 0) {
                    chrome.browserAction.setIcon({
                        path: normalIcon
                    });
                    chrome.browserAction.setBadgeText({
                        text: ''
                    });
                    progressRunning = false;
                }
            });
        }

        if (downloadDelta.state && downloadDelta.state.current === State.interrupted.code) {
            onDownloadInterrupted(downloadDelta);
        }

        if (downloadDelta.paused) {
            //下载页面暂停,恢复下载
            if (downloadDelta.paused.current) {
                if (downloadDelta.canResume.current) {
                    //从下载变为暂停,并且可以恢复
                    chrome.runtime.sendMessage({
                        method: 'pauseDownloadItem',
                        data: downloadDelta.id
                    });
                } else {
                    //从下载变为暂停,并且不可恢复
                    chrome.runtime.sendMessage({
                        method: 'cancelDownloadItem',
                        data: downloadDelta.id
                    });
                }
            } else {
                //从暂停变为下载,并且之前状态指明可以回复
                if (downloadDelta.canResume.previous) {
                    if (!progressRunning)
                        pullProgress();
                } else {
                    //从下暂停变为下载,并且之前状态指明不可恢复
                    chrome.runtime.sendMessage({
                        method: 'cancelDownloadItem',
                        data: downloadDelta.id
                    });
                }
            }
        }

        if (downloadDelta.exists && !downloadDelta.exists.current) {
            //文件不存在
            chrome.downloads.erase({
                id: downloadDelta.id
            }, function () {

            });
        }

        if (downloadDelta.danger && downloadDelta.danger.current !== DangerType.safe.code && downloadDelta.danger.current !== DangerType.accepted.code && notice) {
            chrome.notifications.getPermissionLevel(function (level) {
                if (level === 'granted') {
                    chrome.downloads.search({id: downloadDelta.id}, results => {
                        if (results.length > 0) {
                            chrome.notifications.create('danger-' + downloadDelta.id, {
                                type: 'basic',
                                title: chrome.i18n.getMessage('safetyWaring'),
                                message: Util.filename(results[0].filename),
                                contextMessage: DangerType.valueOf(downloadDelta.danger.current).name,
                                iconUrl: iconCache[downloadDelta.id] || '/img/icon_green.png',
                                isClickable: true
                            }, notificationId => {

                            });

                        }
                    });
                }
            });
        }
    }
});

chrome.downloads.onErased.addListener(function (id) {
    //发送消除下载请求
    chrome.runtime.sendMessage({
        method: 'eraseDownloadItem',
        data: id
    });
});

chrome.notifications.onClicked.addListener(notificationId => {
    if (notificationId.indexOf('danger') !== -1) {
        // 发送渲染有危险的条目请求
        let itemId = parseInt(id.substring(id.indexOf("-") + 1));
    }
    chrome.notifications.clear(notificationId);
});

chrome.notifications.onButtonClicked.addListener((id, index) => {
    chrome.notifications.clear(id);
    if (id.indexOf("complete") > -1) {
        if (index === 0) {
            chrome.downloads.open(parseInt(id.substring(id.indexOf("-") + 1)));
        } else if (index === 1) {
            chrome.downloads.show(parseInt(id.substring(id.indexOf("-") + 1)));
        }
    }
});

// chrome.downloads.onDeterminingFilename.addListener(function (downloadItem) {
//     //发送更新文件名请求
//     chrome.runtime.sendMessage({
//         method: 'updateFilename',
//         data: downloadItem
//     });
// });

/**
 * 缓存图标：如果图标已存在，则直接发送更新图标请求
 * 所有最终更新图标的请求都在这里发起
 *
 * @param id {number} 图标对应的下载对象id
 * @param force {boolean} 是否强制更新。用于下载完成后
 * @param callback {function}
 */
function cacheIcon(id, force = false, callback = null) {
    if (!force && iconCache.hasOwnProperty(id)) {
        chrome.runtime.sendMessage({
            method: 'updateIcon',
            data: iconCache[id]
        });
    } else {
        chrome.downloads.getFileIcon(id, {
            'size': 32
        }, function (icon) {
            if (icon) {
                iconCache[id] = {
                    id: id,
                    icon: icon
                };
                chrome.runtime.sendMessage({
                    method: 'updateIcon',
                    data: iconCache[id]
                });
                if(callback){
                    callback(iconCache[id]);
                }
            }
        });
    }
}

chrome.downloads.search({}, function (results) {
    results.forEach(function (result) {
        cacheIcon(result.id);
    });
});

/**
 * 下载中断事件处理
 * @param {*} downloadDelta 
 */
function onDownloadInterrupted(downloadDelta){
    let id = downloadDelta.id;
    if(downloadDelta.error && downloadDelta.error.current === 'USER_CANCELED'){//用户取消下载
        //下载页面取消下载
        chrome.runtime.sendMessage({
            method: 'cancelDownloadItem',
            data: id
        });
    }else{//其他原因导致的中断，那么应该隶属于暂停范畴
        //更新状态，取消下载事件得到后，这个任务有可能会变为可继续下载的状态
        chrome.downloads.search({
            id: id
        }, function (results) {
            if (results.length > 0){
                let result = results[0];
                if(!result.canResume){//如果这个任务不能继续下载了
                    //下载页面取消下载
                    chrome.runtime.sendMessage({
                        method: 'cancelDownloadItem',
                        data: id
                    });
                }else{//如果这个任务已经变为可以继续下载了
                    //那么先显示成暂停状态
                    chrome.runtime.sendMessage({
                        method: 'pauseDownloadItem',
                        data: id
                    });

                    //根据用户配置，尝试自动继续下载
                    tryAutoResume(id);
                }
            }
        });
    }
}

/**
 * 尝试自动继续下载
 * @param {*} id 
 */
function tryAutoResume(id){
    if(autoResume){//如果启用了自动继续下载
        //构建随机范围，防止远程服务器机器人判定（弱版）
        let min = 300;
        let max = 1200;
        let sleepTime = min + (max - min) * Math.random();

        //通知界面要开始尝试恢复这个任务了
        chrome.runtime.sendMessage({
            method : 'tryResumeDownloadWait',
            data : id
        });

        //延迟执行
        setTimeout(function(){
            //执行任务恢复
            resumeTask(id);
        }, sleepTime);
    }
}

/**
 * 回调读取文件下载进度
 */
function pullProgress() {
    progressRunning = true;
    var startTime = new Date().getTime();
    chrome.downloads.search({
        state: State.in_progress.code,
        paused: false
    }, function (results) {
        downLoadingFiles = results;
        //若没有正在下载的文件，则把图标改回默认
        if (results.length === 0) {
            chrome.browserAction.setIcon({
                path: normalIcon
            });
            chrome.browserAction.setBadgeText({
                text: ''
            });
            progressRunning = false;
            return;
        }
        //否则改下载图标，改下载进度
        chrome.browserAction.setBadgeText({
            text: downLoadingFiles.length + ''
        });
        chrome.browserAction.setIcon({
            path: '/img/icon_green.png'
        }, function () {
            // body...
        });
        //发送更新文件进度请求
        chrome.runtime.sendMessage({
            method: 'updateProgress',
            data: downLoadingFiles
        });
        var endTime = new Date().getTime();
        var timer = setTimeout(function () {
            clearTimeout(timer);
            pullProgress();
        }, 1000 - (endTime - startTime));
    });
}

//是否深色模式
function isDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function changeIcon() {
    if (isDark()) {
        normalIcon = '/img/icon_light.png';
    } else {
        normalIcon = '/img/icon_gray.png';
    }
    chrome.browserAction.setIcon({path: normalIcon});
}

let wav = "audio/download-complete.wav";
let audio = new Audio(wav);

function playSound() {
    audio.play();
}

/**
 * 继续下载任务
 * @param {*} id 
 */
function resumeTask(id){
    let obj = {
        id : id
    };
    chrome.downloads.search(obj, function (results) {
        if (results.length > 0) {
            let item = results[0];
            if (item.paused || item.state === State.interrupted.code) {//如果是暂停了。或者状态是中断了
                chrome.downloads.resume(id, function () {
                    //重新查询任务状态
                    chrome.downloads.search(obj, function(results){
                        if (results.length > 0) {
                            let item = results[0];
                            if(item.paused || item.state === State.interrupted.code){//如果恢复失败
                                //通知界面本次自动恢复继续下载失败
                                chrome.runtime.sendMessage({
                                    method : 'tryResumeDownloadFail',
                                    data : id
                                });

                                //重新尝试自动恢复
                                let min = 3000;
                                let max = 5000;
                                let sleepTimeBasic = min + (max - min) * Math.random();
                                setTimeout(function(){
                                    tryAutoResume(id);
                                }, sleepTimeBasic);
                            }else{//如果恢复成功
                                chrome.runtime.sendMessage({
                                    method : 'resumeDownloadItem',
                                    data : id
                                });
                            }
                        }
                    });
                });
            }
        }
    });
}

pullProgress();