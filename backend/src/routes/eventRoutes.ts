import { Router } from "express";
import { verifyToken } from "../controllers/userController";
import {
  createEvent,
  getAllEvents,
  getEventById,
  updateEventById,
  deleteEventById,
  getEventsByQuery
} from "../controllers/eventController";

const router = Router();

router.get("/", getAllEvents);
router.get("/query/:field/:value", getEventsByQuery);
router.get("/:id", getEventById);

router.post("/", verifyToken, createEvent);
router.put("/:id", verifyToken, updateEventById);
router.delete("/:id", verifyToken, deleteEventById);

export default router;
