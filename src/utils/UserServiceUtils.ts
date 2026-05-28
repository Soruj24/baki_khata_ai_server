import mongoose, { Types } from "mongoose";

interface IUserDoc {
  validate(): Promise<void>;
  save(): Promise<IUserDoc>;
  _id: Types.ObjectId;
  email: string;
  storeName: string;
  displayName: string;
  avatar: string;
  isOnline: boolean;
  lastSeen: Date;
  isActive: boolean;
  isBanned: boolean;
  isDeleted: boolean;
  isVerified: boolean;
  emailVerified: boolean;
  role: string;
  loginAttempts: number;
  lockoutUntil?: Date;
  status: string;
  friends: any[];
  followers: any[];
  following: any[];
  friendRequests?: { received: any[] };
  loginHistory?: any[];
  password: string;
  profileCompletion: number;
  totalConnections: number;
  accountAgeInDays: number;
  loginCount: number;
  lastLoginAt: Date;
  detectedCountry: string;
  preferences: { language: string };
  createdAt: Date;
  toSafeJSON(): Record<string, any>;
  isAccountLocked(): boolean;
  isAccountActive: boolean;
  comparePassword(password: string): Promise<boolean>;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  addLoginHistory(details: any): Promise<void>;
  updateLastSeen(): Promise<void>;
  addAuditLog(action: string, details: any): Promise<void>;
}

const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
  DELETED: "deleted",
} as const;

export const UserServiceUtils = {
  async createUser(userData: Record<string, any>): Promise<IUserDoc> {
    const User = getModel("User");
    const user = new User(userData) as IUserDoc;
    await user.validate();
    return user.save();
  },

  async authenticateUser(
    identifier: string,
    password: string,
    loginDetails: Record<string, any>,
  ): Promise<{ user: IUserDoc | null; success: boolean; message: string }> {
    try {
      const User = getModel("User");
      const user = (await User.findOne({
        $or: [
          { email: identifier.toLowerCase() },
          { storeName: identifier.toLowerCase() },
        ],
      }).select("+password +loginAttempts +lockoutUntil")) as IUserDoc | null;

      if (!user) {
        return { user: null, success: false, message: "User not found" };
      }

      if (user.isAccountLocked()) {
        await user.addLoginHistory({ ...loginDetails, success: false, failureReason: "Account locked" });
        return { user: null, success: false, message: "Account is temporarily locked" };
      }

      if (!user.isAccountActive) {
        await user.addLoginHistory({ ...loginDetails, success: false, failureReason: "Account inactive" });
        return { user: null, success: false, message: "Account is not active" };
      }

      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        await user.incrementLoginAttempts();
        await user.addLoginHistory({ ...loginDetails, success: false, failureReason: "Invalid password" });
        return { user: null, success: false, message: "Invalid credentials" };
      }

      if ((user.loginAttempts || 0) > 0) {
        await user.resetLoginAttempts();
      }

      await user.addLoginHistory({ ...loginDetails, success: true });
      await user.updateLastSeen();

      return { user, success: true, message: "Login successful" };
    } catch (error) {
      console.error("Authentication error:", error);
      return { user: null, success: false, message: "Authentication failed" };
    }
  },

  async getUserDashboard(userId: Types.ObjectId): Promise<any> {
    const User = getModel("User");
    const user = (await User.findById(userId)
      .populate("friends", "storeName displayName avatar isOnline lastSeen")
      .populate("followers", "storeName displayName avatar isOnline")
      .populate("following", "storeName displayName avatar isOnline")) as IUserDoc | null;

    if (!user) {
      throw new Error("User not found");
    }

    return {
      profile: user.toSafeJSON(),
      stats: {
        profileCompletion: user.profileCompletion,
        totalConnections: user.totalConnections,
        accountAge: user.accountAgeInDays,
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
      },
      connections: {
        friends: user.friends,
        followers: user.followers,
        following: user.following,
        pendingRequests: user.friendRequests?.received.length || 0,
      },
      recentActivity: user.loginHistory?.slice(0, 5) || [],
    };
  },

  async batchUserOperations(
    operations: Array<{
      userId: Types.ObjectId;
      operation: "activate" | "deactivate" | "ban" | "unban" | "verify" | "delete";
      reason?: string;
    }>,
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const User = getModel("User");
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const op of operations) {
      try {
        const user = (await User.findById(op.userId)) as IUserDoc | null;
        if (!user) {
          errors.push(`User ${op.userId} not found`);
          failed++;
          continue;
        }

        switch (op.operation) {
          case "activate":
            user.status = UserStatus.ACTIVE;
            user.isActive = true;
            break;
          case "deactivate":
            user.status = UserStatus.INACTIVE;
            user.isActive = false;
            break;
          case "ban":
            user.isBanned = true;
            user.status = UserStatus.SUSPENDED;
            break;
          case "unban":
            user.isBanned = false;
            user.status = UserStatus.ACTIVE;
            break;
          case "verify":
            user.isVerified = true;
            user.emailVerified = true;
            break;
          case "delete":
            user.isDeleted = true;
            user.status = UserStatus.DELETED;
            break;
        }

        await user.addAuditLog(`BATCH_${op.operation.toUpperCase()}`, {
          reason: op.reason,
          batchOperation: true,
        });

        await user.save();
        success++;
      } catch (error: any) {
        errors.push(`Failed to ${op.operation} user ${op.userId}: ${error.message}`);
        failed++;
      }
    }

    return { success, failed, errors };
  },

  async advancedUserSearch(filters: {
    query?: string;
    status?: string;
    role?: string;
    isVerified?: boolean;
    isOnline?: boolean;
    country?: string;
    language?: string;
    dateRange?: { start: Date; end: Date };
    limit?: number;
    skip?: number;
    sortBy?: string;
  }) {
    const User = getModel("User");
    const {
      query,
      status,
      role,
      isVerified,
      isOnline,
      country,
      language,
      dateRange,
      limit = 20,
      skip = 0,
      sortBy = "-createdAt",
    } = filters;

    const searchFilter: any = {
      isDeleted: { $ne: true },
      isBanned: false,
    };

    if (query) {
      searchFilter.$or = [
        { storeName: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
        { displayName: { $regex: query, $options: "i" } },
      ];
    }

    if (status) searchFilter.status = status;
    if (role) searchFilter.role = role;
    if (isVerified !== undefined) searchFilter.isVerified = isVerified;
    if (isOnline !== undefined) searchFilter.isOnline = isOnline;
    if (country) searchFilter.detectedCountry = country.toUpperCase();
    if (language) searchFilter["preferences.language"] = language;
    if (dateRange) {
      searchFilter.createdAt = {
        $gte: dateRange.start,
        $lte: dateRange.end,
      };
    }

    const users = await User.find(searchFilter)
      .limit(limit)
      .skip(skip)
      .sort(sortBy)
      .select(
        "storeName email displayName avatar isOnline lastSeen role isVerified detectedCountry preferences.language createdAt",
      );

    const total = await User.countDocuments(searchFilter);

    return {
      users,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + users.length < total,
      },
    };
  },
};

function getModel(name: string) {
  return (mongoose as any).models[name] || (mongoose as any).model(name);
}
