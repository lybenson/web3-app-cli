#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

import minimist from 'minimist'
import { red, reset } from 'kolorist'
import prompts from 'prompts'
import { emptyDir, formatTargetDir, isEmpty, isValidPackageName, toValidPackageName, write, writeContent, pkgFromUserAgent } from './utils.js'
import { TEMPLATES, DEFAULT_TARGET_DIR, POINTS } from './const.js'
import shell from './shell.js'

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
      message: reset('Select an language'),
      initial: 0,
      choices: TEMPLATES.map(tpl => {
        return {
          title: tpl.color(tpl.name),
          value: tpl.name
        }
      })
    },
    {
      type: 'multiselect',
      name: 'points',
      message: reset('Pick Point'),
      choices: POINTS.map(point => {
        return {
          title: point.color(point.name),
          value: point.name,
          selected: true
        }
      }),
      instructions: '',
      min: 1,
      hint: '- Space to select. Return to submit'
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

  const { overwrite, packageName, language, points } = result
  console.log(result)

  let templateName = `hardhat-react-${ language === 'JavaScript' ? 'js' : 'ts' }`

  if (points.length === 1) {
    if (points[0] === 'hardhat') {
      templateName += '/packages/chain-app'
    }
    if (points[0] === 'react') {
      templateName += '/packages/react-app'
    }
  }

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

  if (!pkg.devDependencies['eslint']) {
    if (language === 'TypeScript') {
      pkg.devDependencies['@typescript-eslint/eslint-plugin'] = '^5.30.7'
      pkg.devDependencies['@typescript-eslint/parser'] = '^5.30.7'
      pkg.devDependencies['typescript'] = '^4.7.4'
    }
    pkg.devDependencies['eslint'] = '^8.20.0'
    pkg.devDependencies['eslint-config-standard'] = '^17.0.0'
    pkg.devDependencies['eslint-plugin-import'] = '^2.26.0'
    pkg.devDependencies['eslint-plugin-n'] = '^15.2.4'
    pkg.devDependencies['eslint-plugin-promise'] = '^6.0.0'
    if (points.indexOf('react') > -1) pkg.devDependencies['eslint-plugin-react'] = '^7.30.1'
  }

  writeContent(root, 'package.json', JSON.stringify(pkg, null, 2))

  const pkgInfo = pkgFromUserAgent(process.env.npm_config_user_agent)
  const pkgManager = pkgInfo ? pkgInfo.name : 'yarn'

  console.log(`\nDone. Now run:\n`)

  if (root !== cwd) {
    console.log(`  cd ${path.relative(cwd, root)}`)
  }

  try {
    shell.exec(`cd ${path.relative(cwd, root)} && git init`)
  } catch (error) {
    console.error(error)
  }

  switch (pkgManager) {
    case 'yarn':
      console.log('  yarn')
      points.length === 1 && points[0] === 'react' && console.log('  yarn dev')
      break
    default:
      console.log(`  ${pkgManager} install`)
      points.length === 1 && points[0] === 'react' && console.log(`  ${pkgManager} run dev`)
      break
  }
  console.log()
}

main().catch(e => {
  console.log(e)
  console.error(e)
})
