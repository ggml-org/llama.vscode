import { Application } from "./application";
import { Utils } from "./utils";
import * as fs from 'fs';

type ReminderFunction = (iteration: number) => string;
export interface ReminderItem {
  frequency: number;
  reminderFunction: ReminderFunction;
}

export const REMINDER_NAME = {
  TODO: 'todo' as const,
  EDIT_FILE: 'edit_file' as const,
} as const;

export class AgentReminder {
    private app: Application;
    private reminders: Map<string, ReminderItem> = new Map();
    

    constructor(application: Application) {
        this.app = application;
        this.initReminders();
    }

    getReminders = (iteration: number) => {
        let remindersText = "";
        for (const [_, reminder] of this.reminders){
            if (iteration % reminder.frequency == 0 ){
                const currentRemText = reminder.reminderFunction(iteration);
                if (currentRemText.trim() != "") {
                    remindersText += currentRemText + "\n\n";
                }
            }
        }

        return remindersText;
    }

    remindTodos = (iteration: number ) => {
        const todoFile = Utils.getTodosFilePath()
        // iteration % this.app.configuration.plan_review_frequency == 0
        if (fs.existsSync(todoFile) ){
            const goal = "Task: \n" + this.app.llamaAgent.getOriginalQuery()
            let currentPlan = "Below is the todo list:\n"
            currentPlan += fs.readFileSync(todoFile, "utf-8")
            // this.messages.push({"role": "user", "content": goal + "\n\n" + currentPlan})                   
            return `${goal} + "\n\n" + ${currentPlan}`
        }
        return ''
        
    }

    remindEditFile = (iteration: number ) => {
        return `If you use edit_file tool, the input parameter should has the following ${this.app.prompts.EDIT_TOOL_BASIC_STRUCTURE}} `
    }

    initReminders = () => {
        this.initTodoReminder();
        this.initEditFileReminder();        
    }

    private initTodoReminder = () => {
        this.reminders.delete(REMINDER_NAME.TODO);
        if (this.app.configuration.tool_update_todo_list_enabled
            && this.app.configuration.plan_review_frequency
            && this.app.configuration.plan_review_frequency > 0) {
            this.reminders.set(
                REMINDER_NAME.TODO,
                {
                    frequency: this.app.configuration.plan_review_frequency,
                    reminderFunction: this.remindTodos
                }
            );
        }
    }

    private initEditFileReminder = () => {
        this.reminders.delete(REMINDER_NAME.EDIT_FILE);
        if (this.app.configuration.tool_edit_file_enabled
            && this.app.configuration.reminder_edit_file_frequency
            && this.app.configuration.reminder_edit_file_frequency > 0) {
            this.reminders.set(
                REMINDER_NAME.EDIT_FILE,
                {
                    frequency: this.app.configuration.reminder_edit_file_frequency,
                    reminderFunction: this.remindEditFile
                }
            );
        }
    }
}
