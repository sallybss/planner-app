process.env.NODE_ENV = 'test'

import { test } from '@playwright/test'

import eventTestCollection from './event.test'
import health from './health.test'
import userTestCollection from './user.test'

test.describe(eventTestCollection)
test.describe(health)
test.describe(userTestCollection)
