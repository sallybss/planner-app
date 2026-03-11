import { Request, Response } from "express";
import { eventModel } from "../models/eventModel";
import { connect, disconnect } from "../repository/database";

function isValidDate(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function pickEventBody(body: any) {
  const event: any = {};

  if (typeof body.title === "string") event.title = body.title;
  if (typeof body.description === "string") event.description = body.description;
  if (typeof body.startTime === "string") event.startTime = body.startTime;
  if (typeof body.endTime === "string") event.endTime = body.endTime;
  if (typeof body.color === "string") event.color = body.color;
  if (typeof body.category === "string") event.category = body.category;
  if (typeof body.owner === "string") event.owner = body.owner;

  if (body.date !== undefined) {
    if (!isValidDate(body.date)) {
      throw new Error("date must be a valid date");
    }
    event.date = new Date(body.date);
  }

  return event;
}

export async function createEvent(req: Request, res: Response): Promise<void> {
  try {
    await connect();

    const data = pickEventBody(req.body);
    const event = new eventModel(data);
    const result = await event.save();

    res.status(201).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("date") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function getAllEvents(req: Request, res: Response) {
  try {
    await connect();

    const { title, category, owner, color } = req.query;
    const filter: any = {};

    if (title) filter.title = { $regex: String(title), $options: "i" };
    if (category) filter.category = { $regex: String(category), $options: "i" };
    if (color) filter.color = { $regex: String(color), $options: "i" };
    if (owner) filter.owner = String(owner);

    const result = await eventModel.find(filter).sort({ createdAt: -1 });
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving events. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function getEventById(req: Request, res: Response) {
  try {
    await connect();

    const id = req.params.id;
    const result = await eventModel.findById(id);

    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving event by id. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function getEventsByQuery(req: Request, res: Response) {
  const key = String(req.params.key);
  const val = req.params.val;

  try {
    await connect();

    const result = await eventModel.find({
      [key]: { $regex: val, $options: "i" }
    } as any);

    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving events. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function updateEventById(req: Request, res: Response) {
  const id = req.params.id;

  try {
    await connect();

    const update = pickEventBody(req.body);
    const result = await eventModel.findByIdAndUpdate(id, update, { new: true });

    if (!result) res.status(404).send("Cannot update event with id=" + id);
    else res.status(200).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("date") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function deleteEventById(req: Request, res: Response) {
  const id = req.params.id;

  try {
    await connect();

    const result = await eventModel.findByIdAndDelete(id);

    if (!result) res.status(404).send("Cannot delete event with id=" + id);
    else res.status(200).send("Event was succesfully deleted.");
  } catch (err) {
    res.status(500).send("Error deleting event by id. Error: " + err);
  } finally {
    await disconnect();
  }
}
