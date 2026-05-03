import { Router } from "express";
import { verifyToken } from "../controllers/userController";
import {
  createTask,
  deleteTaskById,
  getAllTasks,
  getTaskById,
  updateTaskById
} from "../controllers/taskController";

const router = Router();

router.get("/", getAllTasks);
router.get("/:id", getTaskById);

router.post("/", verifyToken, createTask);
router.put("/:id", verifyToken, updateTaskById);
router.delete("/:id", verifyToken, deleteTaskById);

export default router;
