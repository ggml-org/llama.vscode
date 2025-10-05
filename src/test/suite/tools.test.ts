/// <reference types="mocha" />
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { Tools } from '../../tools';
import { Application } from '../../application';
import { Utils } from '../../utils';
import { suite, test, setup } from 'mocha';

// Mock the Application class for testing
class MockApplication {
    configuration = {
        MAX_CHARS_TOOL_RETURN: 10000
    };
    
    chatContext = {
        getRagContextChunks: () => Promise.resolve([]),
        getContextChunksInPlainText: () => Promise.resolve(''),
        entries: []
    };
    
    llamaServer = {
        executeCommandWithTerminalFeedback: () => Promise.resolve({ stdout: '', stderr: '' })
    };
    
    git = {
        getLatestChanges: () => Promise.resolve('')
    };
}

// Use Mocha's suite/test syntax
suite('Tools readFile Function Test Suite', () => {
    let tools: Tools;
    let mockApp: Application;

    setup(() => {
        mockApp = new MockApplication() as unknown as Application;
        tools = new Tools(mockApp);
    });

    test('should read specific lines from a file', async () => {
        console.log('Starting test: should read specific lines from a file');
        
        // Mock the Utils.getAbsolutFilePath to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = (filePath: string) => {
            console.log(`Mock getAbsolutFilePath called with: ${filePath}`);
            if (filePath === 'src/menu.ts') {
                const resolvedPath = path.resolve(__dirname, '../../../src/menu.ts');
                console.log(`Resolved path: ${resolvedPath}`);
                return resolvedPath;
            }
            return '';
        };

        try {
            // Test reading lines 1-10 from menu.ts
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                first_line: 1,
                last_line_inclusive: 10
            });

            console.log(`Calling tools.readFile with args: ${args}`);
            const result = await tools.readFile(args);
            console.log(`Result length: ${result.length}`);
            console.log(`Result preview: ${result.substring(0, 200)}...`);
            
            // Verify that the result is not an error message
            assert.ok(!result.includes('Error reading file'), `Expected file content but got error: ${result}`);
            assert.ok(!result.includes('File not found'), `Expected file content but got file not found: ${result}`);
            assert.ok(!result.includes('Invalid line range'), `Expected file content but got invalid line range: ${result}`);
            
            // Verify that the result contains expected content
            assert.ok(result.length > 0, 'Expected non-empty result');
            
            // More detailed assertions
            assert.ok(result.includes('import'), 'Expected to find import statements');
            assert.ok(result.includes('export'), 'Expected to find export statements');
            
            // The content should include the class definition
            assert.ok(result.includes('class Menu') || result.includes('export class Menu'), 
                `Expected to find Menu class definition in the result. Actual content: ${result.substring(0, 500)}`);

        } finally {
            // Restore the original function
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('should return error for missing file path', async () => {
        const args = JSON.stringify({
            first_line: 1,
            last_line_inclusive: 10
            // file_path is missing
        });

        const result = await tools.readFile(args);
        assert.strictEqual(result, 'The file is not provided.');
    });

    test('should return error for non-existent file', async () => {
        const args = JSON.stringify({
            file_path: 'non-existent-file.txt',
            first_line: 1,
            last_line_inclusive: 10
        });

        const result = await tools.readFile(args);
        assert.ok(result.includes('File not found'), `Expected file not found error but got: ${result}`);
    });

    test('should return error for invalid line range', async () => {
        // Mock to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = () => path.resolve(__dirname, '../../../src/menu.ts');

        try {
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                first_line: 1000, // Invalid line number
                last_line_inclusive: 10 // Invalid range
            });

            const result = await tools.readFile(args);
            assert.strictEqual(result, 'Invalid line range');
        } finally {
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('should handle read entire file', async () => {
        // Mock the Utils.getAbsolutFilePath to return a valid path
        const originalGetAbsolutFilePath = Utils.getAbsolutFilePath;
        Utils.getAbsolutFilePath = (filePath: string) => {
            if (filePath === 'src/menu.ts') {
                return path.resolve(__dirname, '../../../src/menu.ts');
            }
            return '';
        };

        try {
            const args = JSON.stringify({
                file_path: 'src/menu.ts',
                should_read_entire_file: true
            });

            const result = await tools.readFile(args);
            
            // Verify that the result is the entire file content
            assert.ok(result.length > 0, 'Expected non-empty result for entire file');
            assert.ok(result.includes('class Menu'), 'Expected to find class definition in entire file');

        } finally {
            Utils.getAbsolutFilePath = originalGetAbsolutFilePath;
        }
    });

    test('debug: test individual components', async () => {
        console.log('=== DEBUG TEST ===');
        
        // Test 1: Check if Utils.getAbsolutFilePath works
        const testPath = Utils.getAbsolutFilePath('src/menu.ts');
        console.log(`Utils.getAbsolutFilePath result: ${testPath}`);
        
        // Test 2: Check if file exists
        const fs = require('fs');
        const fileExists = fs.existsSync(testPath);
        console.log(`File exists: ${fileExists}`);
        
        // Test 3: Check file content
        if (fileExists) {
            const fileContent = fs.readFileSync(testPath, 'utf8');
            console.log(`File content length: ${fileContent.length}`);
            console.log(`First 100 chars: ${fileContent.substring(0, 100)}`);
        }
        
        // Test 4: Check mock application
        console.log(`Mock app configuration:`, mockApp.configuration);
        console.log(`Mock app chatContext:`, mockApp.chatContext);
        
        assert.ok(true, 'Debug test completed');
    });
});