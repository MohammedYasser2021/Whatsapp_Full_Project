const express = require('express');
const { exec, spawn } = require('child_process');
const path = require('path');
const app = express();
const port = 3333;

// Store background processes
const backgroundProcesses = [];

app.use(express.json());
app.use(express.static(__dirname));

// Route to execute commands
app.post('/execute-command', (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ success: false, error: 'No command provided' });
    }
    
    console.log('Executing command:', command);
    
    exec(command, { cwd: __dirname }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return res.json({ success: false, error: error.message });
        }
        
        const output = stdout + (stderr ? '\nStderr: ' + stderr : '');
        res.json({ success: true, output });
    });
});

// Route to execute background commands
app.post('/execute-background', (req, res) => {
    const { command } = req.body;
    
    if (!command) {
        return res.status(400).json({ success: false, error: 'No command provided' });
    }
    
    console.log('Executing background command:', command);
    
    try {
        // Split the command into parts
        const parts = command.split(' && ');
        const cdCommand = parts[0].split(' ');
        const actualCommand = parts[1].split(' ');
        
        // Extract the directory from cd command
        const directory = cdCommand[1];
        
        // Execute the actual command in the specified directory
        const process = spawn(actualCommand[0], actualCommand.slice(1), {
            cwd: path.join(__dirname, directory),
            shell: true,
            detached: true,
            stdio: 'pipe'
        });
        
        // Store the process
        backgroundProcesses.push(process);
        
        // Log output
        process.stdout.on('data', (data) => {
            console.log(`[${command}] stdout: ${data}`);
        });
        
        process.stderr.on('data', (data) => {
            console.error(`[${command}] stderr: ${data}`);
        });
        
        process.on('close', (code) => {
            console.log(`[${command}] process exited with code ${code}`);
        });
        
        res.json({ success: true, pid: process.pid });
        
    } catch (error) {
        console.error(`Error executing background command: ${error.message}`);
        res.json({ success: false, error: error.message });
    }
});

// Serve the setup page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'setup.html'));
});

// Start the server
app.listen(port, () => {
    console.log(`Setup server running at http://localhost:${port}`);
    console.log('Open this URL in your browser to set up and start the WhatsApp project');
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down background processes...');
    backgroundProcesses.forEach(proc => {
        try {
            process.kill(-proc.pid);
        } catch (e) {
            console.error('Error killing process:', e);
        }
    });
    process.exit(0);
});
