import * as path from 'path';
import * as vscode from 'vscode';
import Mocha from 'mocha';
import * as fs from 'fs';

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 10000,
        globals: ['suite', 'test', 'setup', 'teardown', 'suiteSetup', 'suiteTeardown']
    });

    const testsRoot = path.resolve(__dirname, '..');

    try {
        // Find test files manually
        const findTestFiles = (dir: string): string[] => {
            const files: string[] = [];
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    files.push(...findTestFiles(fullPath));
                } else if (item.endsWith('.test.js')) {
                    files.push(fullPath);
                }
            }
            
            return files;
        };
        
        const files = findTestFiles(testsRoot);
        
        // Add files to the test suite
        files.forEach(f => mocha.addFile(f));

        return new Promise((resolve, reject) => {
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        });
    } catch (err) {
        throw err;
    }
}

// This function is called by VS Code when the test controller is created
export function activate(context: vscode.ExtensionContext): void {
    console.log('Tests activated');
}