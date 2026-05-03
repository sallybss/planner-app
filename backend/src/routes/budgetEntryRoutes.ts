import { Router } from "express";
import { verifyToken } from "../controllers/userController";
import {
  createBudgetEntry,
  deleteBudgetEntryById,
  getAllBudgetEntries,
  getBudgetEntryById,
  updateBudgetEntryById
} from "../controllers/budgetEntryController";

const router = Router();

router.get("/", getAllBudgetEntries);
router.get("/:id", getBudgetEntryById);

router.post("/", verifyToken, createBudgetEntry);
router.put("/:id", verifyToken, updateBudgetEntryById);
router.delete("/:id", verifyToken, deleteBudgetEntryById);

export default router;
