import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

export const USER_STATUSES = ["ACTIVE", "WARNING", "BLOCKED", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    roles: [{ type: Schema.Types.ObjectId, ref: "Role", index: true }],
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE", index: true },
    emailVerified: { type: Boolean, default: false },
    avatarUrl: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    // Bumped on password change / forced logout / admin security action.
    // Any previously-issued JWT whose tokenVersion no longer matches is rejected.
    tokenVersion: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

userSchema.virtual("fullName").get(function (this: { firstName: string; lastName: string }) {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const UserModel: Model<UserDocument> = models.User || model<UserDocument>("User", userSchema);
