import { Router } from "express";
import { verifyToken } from "../controllers/userController";
import {
  createNote,
  deleteNoteById,
  getAllNotes,
  getNoteById,
  updateNoteById
} from "../controllers/noteController";

const router = Router();

router.get("/", getAllNotes);
router.get("/:id", getNoteById);

router.post("/", verifyToken, createNote);
router.put("/:id", verifyToken, updateNoteById);
router.delete("/:id", verifyToken, deleteNoteById);

export default router;
