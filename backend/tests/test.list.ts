process.env.NODE_ENV = 'test'

import { test } from '@playwright/test'

import budgetTestCollection from './budget.test'
import eventTestCollection from './event.test'
import health from './health.test'
import noteTestCollection from './note.test'
import taskTestCollection from './task.test'
import userTestCollection from './user.test'

test.describe(budgetTestCollection)
test.describe(eventTestCollection)
test.describe(health)
test.describe(noteTestCollection)
test.describe(taskTestCollection)
test.describe(userTestCollection)
