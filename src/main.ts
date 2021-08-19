import * as core from '@actions/core'
import * as github from '@actions/github'
import {createAction} from './createAction'

const run = createAction(core, github)

run()
