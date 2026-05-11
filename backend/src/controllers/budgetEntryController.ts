import { Request, Response } from "express";
import { budgetEntryModel } from "../models/budgetEntryModel";
import { connect, disconnect } from "../repository/database";

const validTypes = new Set(["income", "fixed", "variable", "savings"]);

function isValidMonth(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

function pickBudgetEntryBody(body: any) {
  const entry: any = {};

  if (body.month !== undefined) {
    if (!isValidMonth(body.month)) {
      throw new Error("month must match YYYY-MM");
    }
    entry.month = body.month;
  }

  if (body.type !== undefined) {
    if (typeof body.type !== "string" || !validTypes.has(body.type)) {
      throw new Error("type must be one of: income, fixed, variable, savings");
    }
    entry.type = body.type;
  }

  if (typeof body.category === "string") entry.category = body.category.trim();
  if (typeof body.label === "string") entry.label = body.label.trim();
  if (typeof body.owner === "string") entry.owner = body.owner;

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new Error("amount must be a number greater than or equal to 0");
    }
    entry.amount = amount;
  }

  return entry;
}

export async function createBudgetEntry(req: Request, res: Response): Promise<void> {
  try {
    await connect();

    const data = pickBudgetEntryBody(req.body);
    const entry = new budgetEntryModel(data);
    const result = await entry.save();

    res.status(201).send(result);
  } catch (err: any) {
    const msg = String(err?.message || err);
    res.status(msg.includes("must") ? 400 : 500).send(msg);
  } finally {
    await disconnect();
  }
}

export async function getAllBudgetEntries(req: Request, res: Response) {
  try {
    await connect();

    const { owner, month, type } = req.query;
    const filter: any = {};

    if (owner) filter.owner = String(owner);
    if (month) filter.month = String(month);
    if (type) filter.type = String(type);

    const result = await budgetEntryModel.find(filter).sort({ month: 1, createdAt: 1 });
    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving budget entries. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function getBudgetEntryById(req: Request, res: Response) {
  try {
    await connect();

    const result = await budgetEntryModel.findById(req.params.id);
    if (!result) {
      res.status(404).send("Budget entry not found.");
      return;
    }

    res.status(200).send(result);
  } catch (err) {
    res.status(500).send("Error retrieving budget entry by id. Error: " + err);
  } finally {
    await disconnect();
  }
}

export async function updateBudgetEntryById(req: Request, res: Response) {
  try {
    await connect();

    const update = pickBudgetEntryBody(req.body);
    const result = await budgetEntryModel.findByIdAndUpdate(req.params.id, update, { returnDocument: 'after' });
    if (!result) {
      res.status(404).send("Cannot update budget entry with id=" + req.params.id);
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

export async function deleteBudgetEntryById(req: Request, res: Response) {
  try {
    await connect();

    const result = await budgetEntryModel.findByIdAndDelete(req.params.id);
    if (!result) {
      res.status(404).send("Cannot delete budget entry with id=" + req.params.id);
      return;
    }

    res.status(200).send("Budget entry was successfully deleted.");
  } catch (err) {
    res.status(500).send("Error deleting budget entry by id. Error: " + err);
  } finally {
    await disconnect();
  }
}
