import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const isWindows = process.platform === 'win32'
const gitCmd = process.platform === 'win32' ? 'git.exe' : 'git'

function run(cmd, args, options = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })

  if (result.status !== 0) {
    if (result.error) {
      console.error('Command failed:', result.error.message)
    }
    process.exit(result.status ?? 1)
  }
}

function runNpm(args) {
  if (isWindows) {
    run('cmd.exe', ['/d', '/s', '/c', 'npm', ...args])
    return
  }

  run('npm', args)
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    shell: false,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return (result.stdout || '').trim()
}

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, answer => resolve(answer.trim()))
  })
}

async function main() {
  const status = runCapture(gitCmd, ['status', '--porcelain'])
  if (!status) {
    console.log('No changes to commit.')
    rl.close()
    return
  }

  const message = await ask('Commit message: ')
  if (!message) {
    console.log('Commit message is required.')
    rl.close()
    process.exit(1)
  }

  const versionInput = await ask('Version (leave blank for patch bump): ')

  rl.close()

  console.log('Starting build...')
  runNpm(['run', 'build'])
  const distPath = path.resolve('dist')
  const distReady = existsSync(distPath) && readdirSync(distPath).length > 0
  if (!distReady) {
    console.log('Build output missing. Expected dist/ to contain files.')
    process.exit(1)
  }

  console.log('Staging changes...')
  run(gitCmd, ['add', '-A'])

  console.log('Committing changes...')
  run(gitCmd, ['commit', '-m', message])

  if (versionInput) {
    console.log(`Bumping version to ${versionInput}...`)
    runNpm(['version', versionInput])
  } else {
    console.log('Bumping version (patch)...')
    runNpm(['version', 'patch'])
  }

  console.log('Pushing commit and tags...')
  run(gitCmd, ['push', 'origin', 'HEAD'])
  run(gitCmd, ['push', 'origin', '--tags'])
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
