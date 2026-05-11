import { Request, Response } from "express";
import { budgetRowDefModel } from "../models/budgetRowDefModel";
import { connect, disconnect } from "../repository/database";

const validTypes = new Set(["income", "fixed", "variable", "savings"]);

function pickBody(body: any) {
  const data: any = {};
  if (typeof body.label === "string") {
    const label = body.label.trim();
    if (!label) throw new Error("label must not be empty");
    data.label = label;
  }
  if (body.type !== undefined) {
    if (!validTypes.has(body.type)) throw new Error("type must be one of: income, fixed, variable");
    data.type = body.type;
  }
  if (typeof body.owner === "string") data.owner = body.owner;
  return data;
}

export async function createBudgetRowDef(req: Request, res: Response): Promise<void> {
  try {
    await connect();
    const data = pickBody(req.body);
    if (!data.label || !data.type || !data.owner) {
      res.status(400).send("label, type, and owner are required");
      return;
    }
    const doc = new budgetRowDefModel(data);
    const result = await doc.save();
    res.status(201).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function getAllBudgetRowDefs(req: Request, res: Response): Promise<void> {
  try {
    await connect();
    const filter: any = {};
    if (req.query.owner) filter.owner = String(req.query.owner);
    if (req.query.type) filter.type = String(req.query.type);
    const result = await budgetRowDefModel.find(filter).sort({ createdAt: 1 });
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving budget row defs. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function updateBudgetRowDefById(req: Request, res: Response): Promise<void> {
  try {
    await connect();
    const update = pickBody(req.body);
    const result = await budgetRowDefModel.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!result) {
      res.status(404).send("Budget row def not found with id=" + req.params.id);
      return;
    }
    res.status(200).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function deleteBudgetRowDefById(req: Request, res: Response): Promise<void> {
  try {
    await connect();
    const result = await budgetRowDefModel.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).send("Budget row def not found with id=" + req.params.id);
      return;
    }
    res.status(200).send("Budget row def deleted.");
  } catch (err) {
    res.status(500).send("Error deleting budget row def. Error: " + err);
  } finally {
    await disconnect();
  }
}
