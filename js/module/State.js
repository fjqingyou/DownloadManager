import { Enum } from "./Enum.js";

class State extends Enum {
    // noinspection JSUnusedGlobalSymbols
    static in_progress = new Enum('in_progress', chrome.i18n.getMessage('inProgress'));
    // noinspection JSUnusedGlobalSymbols
    static interrupted = new Enum('interrupted', chrome.i18n.getMessage('interrupted'));
    // noinspection JSUnusedGlobalSymbols
    static complete = new Enum('complete', chrome.i18n.getMessage('complete'));
    // noinspection JSUnusedGlobalSymbols
    static pause = new Enum('pause', chrome.i18n.getMessage('pause'));
    // noinspection JSUnusedGlobalSymbols
    static pending = new Enum('pending', chrome.i18n.getMessage('pending'));
    // try auto resume
    static tryAutoResumeWait = new Enum('tryAutoResumeWait', chrome.i18n.getMessage('tryAutoResumeWait'));
    // auto resume fail
    static tryAutoResumeFail = new Enum('tryAutoResumeFail', chrome.i18n.getMessage('tryAutoResumeFail'));
    
}

export { State };