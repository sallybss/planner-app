import { Router } from "express";
import { verifyToken } from "../controllers/userController";
import {
  createBudgetRowDef,
  deleteBudgetRowDefById,
  getAllBudgetRowDefs,
  updateBudgetRowDefById,
} from "../controllers/budgetRowDefController";

const router = Router();

router.get("/", getAllBudgetRowDefs);

router.post("/", verifyToken, createBudgetRowDef);
router.put("/:id", verifyToken, updateBudgetRowDefById);
router.delete("/:id", verifyToken, deleteBudgetRowDefById);

export default router;
