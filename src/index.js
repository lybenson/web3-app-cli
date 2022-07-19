#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import minimist from 'minimist'
import { red, reset } from 'kolorist'
import prompts from 'prompts'
import { emptyDir, formatTargetDir, isEmpty, isValidPackageName, toValidPackageName, write, writeContent, pkgFromUserAgent } from './utils.js'
import { TEMPLATES, DEFAULT_TARGET_DIR } from './const.js'

const argv = minimist(process.argv.slice(2), { string: ['_'] })
const cwd = process.cwd()

// main function
async function main() {
  let targetDir = formatTargetDir(argv._[0])

  const getProjectName = () => {
    return targetDir === '.' ? path.basename(path.resolve()) : targetDir
  }

  const questions = [
    {
      type: targetDir ? null : 'text',
      name: 'projectName',
      message: reset('Project name:'),
      initial: DEFAULT_TARGET_DIR,
      onState: state => {
        targetDir = formatTargetDir(state.value) || DEFAULT_TARGET_DIR
      }
    },
    {
      type: () => (!fs.existsSync(targetDir) || isEmpty(targetDir)) ? null : 'confirm',
      name: 'overwrite',
      message: () => {
        return (targetDir === '.' ? 'Current directroy' : `Target directory "${targetDir}"`) +
        ` is not empty. Remove existing files and continue?`
      }
    },
    {
      type: (_,  { overwrite } = {}) => {
        // choice no for overwrite
        if (overwrite === false) {
          throw new Error(red('✖') + ' Operation cancelled')
        }
        return null
      },
      name: 'overwriteChecker'
    },
    {
      type: () => isValidPackageName(getProjectName()) ? null : 'text',
      name: 'packageName',
      message: reset('Package name: '),
      initial: () => toValidPackageName(getProjectName()),
      validate: dir => {
        return isValidPackageName(dir) || 'Invalid package.json name'
      }
    },
    {
      type: 'select',
      name: 'language',
      message: reset('Select a language'),
      initial: 0,
      choices: TEMPLATES.map(tpl => {
        return {
          title: tpl.color(tpl.name),
          value: tpl.name
        }
      })
    }
  ]

  let result = {}
  try {
    result = await prompts(questions, {
      onCancel: () => {
        throw new Error(red('✖') + ' Operation cancelled')
      }
    })
  } catch (cancelled) {
    console.log(cancelled.message)
    return
  }

  const { overwrite, packageName, language } = result

  const templateName = `hardhat-react-${ language === 'JavaScript' ? 'js' : 'ts' }`

  // get project root dir
  const root = path.join(cwd, targetDir)

  if (overwrite) {
    emptyDir(root)
  } else if (!fs.existsSync(root)) {
    // create root dir
    fs.mkdirSync(root, { recursive: true })
  }

  const templateDir = path.resolve(
    fileURLToPath(import.meta.url),
    '../../templates',
    templateName
  )

  const files = fs.readdirSync(templateDir)

  // write all files except for package.json
  for (const file of files.filter(f => f !== 'package.json')) {
    write(templateDir, root, file)
  }

  // write package.json
  const pkg = JSON.parse(
    fs.readFileSync(path.join(templateDir, 'package.json'), 'utf-8')
  )
  pkg.name = packageName || getProjectName()
  writeContent(root, 'package.json', JSON.stringify(pkg, null, 2))

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'yarn'

  console.log(`\nDone. Now run:\n`)

  if (root !== cwd) {
    console.log(`  cd ${path.relative(cwd, root)}`)
  }

  switch (pkgManager) {
    case 'yarn':
      console.log('  yarn')
      console.log('  yarn dev')
      break
    default:
      console.log(`  ${pkgManager} install`)
      console.log(`  ${pkgManager} run dev`)
      break
  }
  console.log()
}

main().catch(e => {
  console.log(e)
  console.error(e)
})
