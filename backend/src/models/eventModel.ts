import { Schema, model, Document } from "mongoose";
import { Event } from "../interfaces/event";

const eventSchema = new Schema<Event>(
  {
    title: { type: String, required: true, minlength: 1, maxlength: 255 },
    description: { type: String, required: false, maxlength: 2000 },
    date: { type: Date, required: true },
    startTime: { type: String, required: false, maxlength: 10 },
    endTime: { type: String, required: false, maxlength: 10 },
    color: { type: String, required: false, maxlength: 50 },
    category: { type: String, required: false, minlength: 1, maxlength: 100 },
    owner: { type: String, ref: "User", required: true }
  },
  { timestamps: true }
);

type UpdateQuery<T> = {
  [key: string]: unknown;
} & {
  __v?: number;
  $set?: Partial<T> & { __v?: number };
  $setOnInsert?: Partial<T> & { __v?: number };
  $inc?: { __v?: number };
};

eventSchema.pre("findOneAndUpdate", function <T extends Document>(this: any) {
  const update = this.getUpdate() as UpdateQuery<T>;

  if (update.__v != null) delete update.__v;

  const keys: Array<"$set" | "$setOnInsert"> = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key]!.__v != null) {
      delete update[key]!.__v;
      if (Object.keys(update[key]!).length === 0) delete update[key];
    }
  }

  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
});

export const eventModel = model<Event>("Event", eventSchema);
