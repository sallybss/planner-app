import { Router } from "express";
import { getAllUsers, registerUser, loginUser } from "../controllers/userController";

const router = Router();

router.get("/users", getAllUsers);
router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
