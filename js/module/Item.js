import {Util} from './Util.js'
import {State} from './State.js'

class Item {
    /**
     * 构建函数
     * @param data {{
          id:number,
          url:string,
          finalUrl:string,
          referrer:string,
          filename:string,
          incognito:boolean,
          danger:string,
          mime:string,
          startTime:string,
          endTime:string,
          estimatedEndTime:string,
          state:string,
          paused:boolean,
          canResume:boolean,
          error:string,
          bytesReceived:number,
          totalBytes:number,
          fileSize:number,
          exists:boolean
     * }}
     */
    constructor(data) {
        this.data = Util.dataProcess(data);
        this.lastBytesReceived = this.data.bytesReceived;
    }

    /**
     *
     * @return {HTMLElement}
     */
    render() {
        let processedData = Util.calculate(this.data);
        let item = Util.item(processedData);
        let render = Util.render(item);
        item.instance = this;
        if (this.data.state === State.complete) {
            return render.completed();
        } else if (this.data.state === State.in_progress) {
            if (processedData.progress === '100%' && this.data.totalBytes !== -1)
                return render.pending();
            return render.downloading();
        } else if (this.data.state === State.pause) {
            return render.pause();
        } else if (this.data.state === State.interrupted) {
            return render.interrupted();
        }
    };

    speed() {
        if (this.data.estimatedEndTime == null) {
            let speed = this.data.bytesReceived === 0 ? '0B/s' : Util.formatBytes(this.data.bytesReceived - this.lastBytesReceived) + '/s';
            this.lastBytesReceived = this.data.bytesReceived;
            return speed;
        } else {
            // 根据时间计算速度
            if (!this.data.estimatedEndTime) return "0B/s";
            let time = (new Date(this.data.estimatedEndTime).getTime() - (new Date).getTime()) / 1e3;
            return time <= 0 ? "0B/s" : Util.formatBytes((this.data.totalBytes - this.data.bytesReceived) / time) + "/s"
        }
    }

    /**
     *
     * @param id {number}
     * @return {Item}
     */
    static of(id) {
        let div = Util.getElement('#item_' + id);
        return div == null ? null : div.instance;
    }

    /**
     *
     * @param data {{
          id:number,
          url:string,
          finalUrl:string,
          referrer:string,
          filename:string,
          incognito:boolean,
          danger:string,
          mime:string,
          startTime:string,
          endTime:string,
          estimatedEndTime:string,
          state:string,
          paused:boolean,
          canResume:boolean,
          error:string,
          bytesReceived:number,
          totalBytes:number,
          fileSize:number,
          exists:boolean
     * }}
     */
    updateProgress(data) {
        this.data = Util.dataProcess(data);
        let div = Util.getElement('#item_' + this.data.id);
        let processedData = Util.calculate(this.data);
        processedData.speed = this.speed();
        Util.getElement('.progress .current', div).style.width = processedData.progress;
        if (processedData.progress === '100%') {
            // Util.getElement('.status .state', div).innerText = State.pending.name;
            // Util.getElement('.status .speed', div).classList.add('hide');
            // Util.getElement('.status .received', div).classList.add('hide');
            Util.getElement('.operation .icon-refresh', div).parentNode.classList.add('hide');
            Util.getElement('.operation .icon-pause', div).parentNode.classList.remove('hide');
            Util.getElement('.operation .icon-resume', div).parentNode.classList.add('hide');
            Util.getElement('.operation .icon-open', div).parentNode.classList.add('hide');
            if (this.data.totalBytes === -1) {
                Util.getElement('.status .speed', div).classList.remove('hide');
                Util.getElement('.status .received', div).classList.remove('hide');
                Util.getElement('.status .state', div).innerText = State.in_progress.name;
                Util.getElement('.status .speed', div).innerText = `, ${processedData.speed} -`;
                Util.getElement('.status .received', div).innerText = processedData.received;
                Util.getElement('.status .size').innerText = `, 共${processedData.size}`;
            } else {
                Util.getElement('.status .state', div).innerText = State.pending.name;
                Util.getElement('.status .speed', div).classList.add('hide');
                Util.getElement('.status .received', div).classList.add('hide');
            }
        } else {
            Util.getElement('.status .speed', div).innerText = `, ${processedData.speed} -`;
            Util.getElement('.status .received', div).innerText = processedData.received;
            Util.getElement('.operation .icon-refresh', div).parentNode.classList.add('hide');
            Util.getElement('.operation .icon-pause', div).parentNode.classList.remove('hide');
            Util.getElement('.operation .icon-resume', div).parentNode.classList.add('hide');
            Util.getElement('.operation .icon-open', div).parentNode.classList.add('hide');
        }
    }

    updateFilename(filename) {
        let div = Util.getElement('#item_' + this.data.id);
        Util.getElement('.name .filename', div).innerText = filename;

    }

    downloadComplete(data) {
        this.data = Util.dataProcess(data);
        let div = Util.getElement('#item_' + this.data.id);
        let processedData = Util.calculate(this.data);
        Util.getElement('.progress .current', div).style.width = '100%';
        Util.getElement('.status .state', div).innerText = State.complete.name;
        Util.getElement('.status .size', div).innerText = ', 共' + processedData.size;
        Util.getElement('.status .speed', div).classList.add('hide');
        Util.getElement('.status .received', div).classList.add('hide');
        Util.getElement('.operation .icon-refresh', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-pause', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-resume', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-open', div).parentNode.classList.remove('hide');
        Util.getElement('.operation .icon-delete', div).parentNode.title = "刪除记录";
    }

    eraseDownloadItem() {
        let div = Util.getElement('#item_' + this.data.id);
        div.remove();
    }

    cancelDownloadItem() {
        let div = Util.getElement('#item_' + this.data.id);
        Util.getElement('.progress .current', div).style.width = '0%';
        Util.getElement('.status .state', div).innerText = State.interrupted.name;
        Util.getElement('.status .speed', div).classList.add('hide');
        Util.getElement('.status .received', div).classList.add('hide');
        Util.getElement('.operation .icon-refresh', div).parentNode.classList.remove('hide');
        Util.getElement('.operation .icon-pause', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-resume', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-open', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-delete', div).parentNode.title = "刪除记录";
        div.classList.add('not-exists');
    }

    pauseDownloadItem() {
        let div = Util.getElement('#item_' + this.data.id);
        Util.getElement('.status .state', div).innerText = State.pause.name;
        Util.getElement('.status .speed', div).innerText = `, 0B/s -`;
        Util.getElement('.operation .icon-refresh', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-pause', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-resume', div).parentNode.classList.remove('hide');
        Util.getElement('.operation .icon-open', div).parentNode.classList.add('hide');
        Util.getElement('.operation .icon-delete', div).parentNode.title = "取消下载";
    }

    resumeDownloadItem() {
        let div = Util.getElement('#item_' + this.data.id);
        Util.getElement('.status .state', div).innerText = State.in_progress.name;
        Util.getElement('.operation .icon-delete', div).parentNode.title = "取消下载";
    }
}

export {Item}