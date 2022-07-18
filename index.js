#!/usr/bin/env node

import minimist from 'minimist'
import { blue, red, reset, yellow } from 'kolorist'

import path from 'node:path'
import prompts from 'prompts'


const argv = minimist(process.argv.slice(2), { string: ['_'] })
const cwd = process.cwd()

const languages = [
  {
    name: 'javascript',
    color: blue
  },
  {
    name: 'typescript',
    color: yellow
  }
]

function formatTargetDir(targetDir) {
  return targetDir?.trim().replace(/\/+$/g, '')
}

async function main() {
  let targetDir = formatTargetDir(argv._[0])
  let template = argv.template || argv.t

  const defaultTargetDir = 'web3-app-project'

  const getProjectName = () =>
    targetDir === '.' ? path.basename(path.resolve()) : targetDir

  console.log(targetDir);

  const questions = [
    {
      type: 'text',
      name: 'projectName',
      message: reset('Project name:'),
      initial: defaultTargetDir
    }
  ]

  let result = await prompts(questions, {
    onCancel: () => {
      throw new Error(red('×', 'Operation cancelled'))
    }
  })

  console.log(result)
}

main()
