import { test, expect } from '@playwright/test'
import { registerAndLogin } from './helpers'

export default function taskTestCollection() {
  test('authenticated user can create, update, list, and delete a task', async ({ request }) => {
    test.setTimeout(30_000)

    const { token, userId } = await registerAndLogin(request, 'sali.task')

    const taskPayload = {
      title: 'Prepare demo script',
      description: 'Walk through board interactions',
      status: 'todo',
      priority: 'medium',
      owner: userId,
    }

    const createResponse = await request.post('/api/tasks', {
      data: taskPayload,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(createResponse.status()).toBe(201)

    const createdTask = await createResponse.json()
    expect(createdTask._id).toBeTruthy()

    const updateResponse = await request.put(`/api/tasks/${createdTask._id}`, {
      data: {
        status: 'in-progress',
        priority: 'high',
        description: 'Walk through board drag and inline editing',
      },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(updateResponse.status()).toBe(200)

    const updatedTask = await updateResponse.json()
    expect(updatedTask.status).toBe('in-progress')
    expect(updatedTask.priority).toBe('high')

    const listResponse = await request.get(
      `/api/tasks?owner=${encodeURIComponent(userId)}&status=in-progress`,
    )
    expect(listResponse.status()).toBe(200)

    const tasks = await listResponse.json()
    const storedTask = tasks.find((task: { _id?: string }) => task._id === createdTask._id)
    expect(storedTask).toBeTruthy()
    expect(storedTask.title).toBe(taskPayload.title)

    const deleteResponse = await request.delete(`/api/tasks/${createdTask._id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    expect(deleteResponse.status()).toBe(200)

    const afterDeleteResponse = await request.get(
      `/api/tasks?owner=${encodeURIComponent(userId)}&status=in-progress`,
    )
    expect(afterDeleteResponse.status()).toBe(200)
    const afterDeleteTasks = await afterDeleteResponse.json()
    expect(afterDeleteTasks.find((task: { _id?: string }) => task._id === createdTask._id)).toBeFalsy()
  })
}
