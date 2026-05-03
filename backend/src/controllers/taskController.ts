import { Request, Response } from "express";
import { taskModel } from "../models/taskModel";
import { connect, disconnect } from "../repository/database";

const validStatuses = new Set(["todo", "in-progress", "done"]);
const validPriorities = new Set(["low", "medium", "high"]);

function pickTaskBody(body: any) {
  const task: any = {};

  if (typeof body.title === "string") task.title = body.title.trim();
  if (typeof body.description === "string") task.description = body.description.trim();
  if (typeof body.owner === "string") task.owner = body.owner;

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !validStatuses.has(body.status)) {
      throw new Error("status must be one of: todo, in-progress, done");
    }
    task.status = body.status;
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !validPriorities.has(body.priority)) {
      throw new Error("priority must be one of: low, medium, high");
    }
    task.priority = body.priority;
  }

  return task;
}

export async function createTask(req: Request, res: Response): Promise<void> {
  try {
    await connect();

    const data = pickTaskBody(req.body);
    const task = new taskModel(data);
    const result = await task.save();

    res.status(201).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must be one of") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function getAllTasks(req: Request, res: Response) {
  try {
    await connect();

    const { owner, status } = req.query;
    const filter: any = {};

    if (owner) filter.owner = String(owner);
    if (status) filter.status = String(status);

    const result = await taskModel.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving tasks. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function getTaskById(req: Request, res: Response) {
  try {
    await connect();

    const result = await taskModel.findById(req.params.id);
    if (!result) {
      res.status(404).send("Task not found.");
      return;
    }

    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving task by id. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function updateTaskById(req: Request, res: Response) {
  try {
    await connect();

    const update = pickTaskBody(req.body);
    const result = await taskModel.findByIdAndUpdate(req.params.id, update, { new: true });

    if (!result) {
      res.status(404).send("Cannot update task with id=" + req.params.id);
      return;
    }

    res.status(200).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must be one of") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function deleteTaskById(req: Request, res: Response) {
  try {
    await connect();

    const result = await taskModel.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).send("Cannot delete task with id=" + req.params.id);
      return;
    }

    res.status(200).send("Task was successfully deleted.");
  } catch (err) {
    res.status(500).send("Error deleting task by id. Error: " + err);
  } finally {
    await disconnect();
  }
}
