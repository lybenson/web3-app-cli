import ChildProcess from 'child_process'

function exec(commands) {
  ChildProcess.exec(commands, (err, stdout, stderr) => {
    if (err) throw err
  })
}

export default {
  exec
}
