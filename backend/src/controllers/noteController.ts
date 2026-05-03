import { Request, Response } from "express";
import { noteModel } from "../models/noteModel";
import { connect, disconnect } from "../repository/database";

const validTones = new Set(["charcoal", "amber", "mint", "violet"]);

function pickNoteBody(body: any) {
  const note: any = {};

  if (typeof body.title === "string") note.title = body.title.trim();
  if (typeof body.content === "string") note.content = body.content.trim();
  if (typeof body.owner === "string") note.owner = body.owner;

  if (body.tone !== undefined) {
    if (typeof body.tone !== "string" || !validTones.has(body.tone)) {
      throw new Error("tone must be one of: charcoal, amber, mint, violet");
    }
    note.tone = body.tone;
  }

  return note;
}

export async function createNote(req: Request, res: Response): Promise<void> {
  try {
    await connect();

    const data = pickNoteBody(req.body);
    const note = new noteModel(data);
    const result = await note.save();

    res.status(201).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must be one of") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function getAllNotes(req: Request, res: Response) {
  try {
    await connect();

    const { owner, q } = req.query;
    const filter: any = {};

    if (owner) filter.owner = String(owner);
    if (q) {
      const query = String(q);
      filter.$or = [
        { title: { $regex: query, $options: "i" } },
        { content: { $regex: query, $options: "i" } }
      ];
    }

    const result = await noteModel.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving notes. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function getNoteById(req: Request, res: Response) {
  try {
    await connect();

    const result = await noteModel.findById(req.params.id);
    if (!result) {
      res.status(404).send("Note not found.");
      return;
    }

    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving note by id. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function updateNoteById(req: Request, res: Response) {
  try {
    await connect();

    const update = pickNoteBody(req.body);
    const result = await noteModel.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!result) {
      res.status(404).send("Cannot update note with id=" + req.params.id);
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

export async function deleteNoteById(req: Request, res: Response) {
  try {
    await connect();

    const result = await noteModel.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).send("Cannot delete note with id=" + req.params.id);
      return;
    }

    res.status(200).send("Note was successfully deleted.");
  } catch (err) {
    res.status(500).send("Error deleting note by id. Error: " + err);
  } finally {
    await disconnect();
  }
}
