// 以子进程执行命令：输出实时镜像到环节日志，失败带上退出码。
import { spawn } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'

export function runCommand(command, args, { cwd, logFile, env }) {
  return new Promise((resolve, reject) => {
    writeFileSync(logFile, `$ ${command} ${args.join(' ')}\n`)
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    child.stdout.on('data', (chunk) => appendFileSync(logFile, chunk))
    child.stderr.on('data', (chunk) => appendFileSync(logFile, chunk))
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} 退出码 ${signal ?? code}，详见 ${logFile}`))
      }
    })
  })
}
