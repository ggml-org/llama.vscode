import {Application} from "./application";

export class Logger {
    private app: Application
    eventlogs: string[] = []

    constructor(application: Application) {
        this.app = application;
    }

    addEventLog = (group: string, event: string, details: string) => {
        this.eventlogs.push(Date.now() + ", " + group + ", " + event + ", " + details.replace(",", " "));
        if (this.eventlogs.length > this.app.configuration.MAX_EVENTS_IN_LOG) {
            this.eventlogs.shift();
        }
    }
}
