import net from 'net';
import repl from 'repl';

export default net.createServer((socket) => {
    const {pid} = process;
    const addr = socket.remoteAddress;
    const port = socket.remotePort;
    
    const r = repl.start({
        prompt: `[${pid} ${addr}:${port}>`,
        input: socket,
        output: socket,
        terminal: true,
        useGlobal: false,
    });
    
    r.on('exit', () => {
        socket.end();
    });
    
    r.context.socket = socket;
}).listen(1337);

