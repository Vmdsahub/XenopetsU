import {
  supabase,
  handleSupabaseError,
  validateGameAction,
} from "../lib/supabase";
import {
  Pet,
  Item,
  Notification,
  User,
  Achievement,
  Collectible,
} from "../types/game";

export class GameService {
  private static instance: GameService;
  private subscriptions: { [key: string]: any } = {};

  public static getInstance(): GameService {
    if (!GameService.instance) {
      GameService.instance = new GameService();
    }
    return GameService.instance;
  }

  // Real-time subscription methods

  /**
   * Subscribe to real-time changes for a user's data
   * @param userId The user ID to subscribe to
   * @param callback Function to call when data changes
   * @returns Subscription ID for unsubscribing
   */
  subscribeToUserData(userId: string, callback: (data: any) => void): string {
    // Generate a unique subscription ID
    const subscriptionId = `user_${userId}_${Date.now()}`;

    // Subscribe to user's pets
    this.subscriptions[`${subscriptionId}_pets`] = supabase
      .channel(`public:pets:owner_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pets",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => callback({ type: "pets", data: payload.new }),
      )
      .subscribe();

    // Subscribe to user's inventory
    this.subscriptions[`${subscriptionId}_inventory`] = supabase
      .channel(`public:inventory:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => callback({ type: "inventory", data: payload.new }),
      )
      .subscribe();

    // Subscribe to user's notifications
    this.subscriptions[`${subscriptionId}_notifications`] = supabase
      .channel(`public:notifications:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => callback({ type: "notifications", data: payload.new }),
      )
      .subscribe();

    // Subscribe to user's currency
    this.subscriptions[`${subscriptionId}_currency`] = supabase
      .channel(`public:user_currency:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_currency",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => callback({ type: "currency", data: payload.new }),
      )
      .subscribe();

    return subscriptionId;
  }

  /**
   * Unsubscribe from all subscriptions for a given ID
   * @param subscriptionId The subscription ID to unsubscribe
   */
  unsubscribe(subscriptionId: string): void {
    // Find all subscriptions that start with this ID
    Object.keys(this.subscriptions)
      .filter((key) => key.startsWith(subscriptionId))
      .forEach((key) => {
        // Unsubscribe from the channel
        this.subscriptions[key].unsubscribe();
        // Remove from our subscriptions object
        delete this.subscriptions[key];
      });
  }

  /**
   * Unsubscribe from all active subscriptions
   */
  unsubscribeAll(): void {
    Object.values(this.subscriptions).forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions = {};
  }

  // Pet operations
  async getUserPets(userId: string): Promise<Pet[]> {
    try {
      const { data, error } = await supabase
        .from("pets")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(this.mapDatabasePetToPet);
    } catch (error) {
      console.error("Error fetching pets:", error);
      return [];
    }
  }

  async removeItemFromInventory(
    userId: string,
    itemId: string,
    quantityToRemove = 1,
  ): Promise<boolean> {
    try {
      await validateGameAction("item_remove", { quantity: quantityToRemove });

      // Find the unequipped item stack in the inventory
      const { data: existingItem, error: fetchError } = await supabase
        .from("inventory")
        .select("id, quantity")
        .eq("user_id", userId)
        .eq("id", itemId)
        .is("equipped_pet_id", null)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error fetching item from inventory:", fetchError);
        throw fetchError;
      }

      if (!existingItem) {
        console.warn(
          `Inventory entry ${itemId} not found in user ${userId}'s unequipped inventory to remove.`,
        );
        return false;
      }

      const newQuantity = existingItem.quantity - quantityToRemove;

      if (newQuantity > 0) {
        // Update quantity
        const { error: updateError } = await supabase
          .from("inventory")
          .update({
            quantity: newQuantity,
            last_used: new Date().toISOString(),
          })
          .eq("id", existingItem.id);

        if (updateError) throw updateError;
      } else {
        // Remove item entry
        const { error: deleteError } = await supabase
          .from("inventory")
          .delete()
          .eq("id", existingItem.id);

        if (deleteError) throw deleteError;
      }

      return true;
    } catch (error) {
      console.error("Error removing item from inventory:", error);
      return false;
    }
  }

  async createPet(
    petData: Omit<Pet, "id" | "createdAt" | "updatedAt">,
  ): Promise<Pet | null> {
    try {
      // Set default image for Griffin species
      const defaultImageUrl =
        petData.species === "Griffin"
          ? "https://cdn.builder.io/api/v1/image/assets%2F00527235c81749aeadef448eefcc705e%2Ffe8040cedae642518cc8c46775fc3786?format=webp&width=800"
          : petData.imageUrl;

      const { data, error } = await supabase
        .from("pets")
        .insert({
          owner_id: petData.ownerId,
          name: petData.name,
          species: petData.species,
          style: petData.style,
          personality: petData.personality,
          happiness: Math.max(0, Math.min(10, petData.happiness)),
          health: Math.max(0, Math.min(10, petData.health)),
          hunger: Math.max(0, Math.min(10, petData.hunger)),
          strength: Math.max(0, petData.strength),
          dexterity: Math.max(0, petData.dexterity),
          intelligence: Math.max(0, petData.intelligence),
          speed: Math.max(0, petData.speed),
          attack: Math.max(0, petData.attack),
          defense: Math.max(0, petData.defense),
          precision: Math.max(0, petData.precision),
          evasion: Math.max(0, petData.evasion),
          luck: Math.max(0, petData.luck),
          is_active: true, // Set as active by default
          image_url: defaultImageUrl,
          hatch_time:
            petData.hatchTime?.toISOString() || new Date().toISOString(),
          last_interaction:
            petData.lastInteraction?.toISOString() || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      return this.mapDatabasePetToPet(data);
    } catch (error) {
      console.error("Error creating pet:", error);
      return null;
    }
  }

  async updatePetStats(petId: string, stats: Partial<Pet>): Promise<boolean> {
    try {
      await validateGameAction("pet_stat_update", { stats });

      const updateData: any = {};

      // Map Pet interface to database columns
      if (stats.happiness !== undefined)
        updateData.happiness = Math.max(0, Math.min(10, stats.happiness));
      if (stats.health !== undefined)
        updateData.health = Math.max(0, Math.min(10, stats.health));
      if (stats.hunger !== undefined)
        updateData.hunger = Math.max(0, Math.min(10, stats.hunger));
      if (stats.strength !== undefined)
        updateData.strength = Math.max(0, stats.strength);
      if (stats.dexterity !== undefined)
        updateData.dexterity = Math.max(0, stats.dexterity);
      if (stats.intelligence !== undefined)
        updateData.intelligence = Math.max(0, stats.intelligence);
      if (stats.speed !== undefined)
        updateData.speed = Math.max(0, stats.speed);
      if (stats.attack !== undefined)
        updateData.attack = Math.max(0, stats.attack);
      if (stats.defense !== undefined)
        updateData.defense = Math.max(0, stats.defense);
      if (stats.precision !== undefined)
        updateData.precision = Math.max(0, stats.precision);
      if (stats.evasion !== undefined)
        updateData.evasion = Math.max(0, stats.evasion);
      if (stats.luck !== undefined) updateData.luck = Math.max(0, stats.luck);
      if (stats.lastInteraction)
        updateData.last_interaction = stats.lastInteraction.toISOString();

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("pets")
        .update(updateData)
        .eq("id", petId);

      if (error) throw error;

      // Recalculate level if stats changed
      if (
        Object.keys(updateData).some((key) =>
          [
            "strength",
            "dexterity",
            "intelligence",
            "speed",
            "attack",
            "defense",
            "precision",
            "evasion",
            "luck",
          ].includes(key),
        )
      ) {
        await supabase.rpc("calculate_pet_level", { pet_id: petId });
      }

      return true;
    } catch (error) {
      console.error("Error updating pet stats:", error);
      return false;
    }
  }

  // Currency operations with enhanced validation
  async updateUserCurrency(
    userId: string,
    currencyType: "xenocoins" | "cash",
    amount: number,
    reason = "game_action",
  ): Promise<boolean> {
    try {
      await validateGameAction("currency_gain", { amount: Math.abs(amount) });

      const { data, error } = await supabase.rpc("update_user_currency", {
        user_id: userId,
        currency_type: currencyType,
        amount: amount,
        reason: reason,
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error("Error updating currency:", error);
      return false;
    }
  }

  async getUserCurrency(
    userId: string,
  ): Promise<{ xenocoins: number; cash: number } | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("xenocoins, cash")
        .eq("id", userId)
        .single();

      if (error) throw error;

      if (!data) {
        console.warn(`No currency data found for user ${userId}`);
        return { xenocoins: 0, cash: 0 };
      }

      return {
        xenocoins: data.xenocoins || 0,
        cash: data.cash || 0,
      };
    } catch (error) {
      console.error("Error fetching currency:", error);
      return null;
    }
  }

  // Enhanced inventory operations
  async getUserInventory(userId: string): Promise<Item[]> {
    try {
      const { data, error } = await supabase
        .from("inventory")
        .select(
          `
          *,
          items (*)
        `,
        )
        .eq("user_id", userId);

      if (error) throw error;

      return data.map((inventoryItem) => ({
        ...inventoryItem.items,
        inventoryId: inventoryItem.id,
        quantity: inventoryItem.quantity,
        isEquipped: inventoryItem.is_equipped,
        equippedPetId: inventoryItem.equipped_pet_id,
        createdAt: new Date(inventoryItem.acquired_at),
      }));
    } catch (error) {
      console.error("Error fetching inventory:", error);
      return [];
    }
  }

  async addItemToInventory(
    userId: string,
    itemId: string,
    quantity = 1,
  ): Promise<{ id: string; itemId: string; quantity: number } | null> {
    try {
      await validateGameAction("item_add", { quantity });

      // Check if item already exists in inventory (unequipped stack)
      const { data: existingStack, error: fetchError } = await supabase
        .from("inventory")
        .select("id, quantity, item_id")
        .eq("user_id", userId)
        .eq("item_id", itemId)
        .is("equipped_pet_id", null)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("Error checking existing inventory item:", fetchError);
        throw fetchError;
      }

      if (existingStack) {
        // Update quantity of existing stack
        const newQuantity = existingStack.quantity + quantity;
        const { data: updatedData, error: updateError } = await supabase
          .from("inventory")
          .update({ quantity: newQuantity })
          .eq("id", existingStack.id)
          .select("id, item_id, quantity")
          .single();

        if (updateError) throw updateError;
        if (!updatedData) throw new Error("Failed to get updated item data.");

        return {
          id: updatedData.id,
          itemId: updatedData.item_id,
          quantity: updatedData.quantity,
        };
      } else {
        // Insert new item entry
        const { data: insertedData, error: insertError } = await supabase
          .from("inventory")
          .insert({
            user_id: userId,
            item_id: itemId,
            quantity: quantity,
          })
          .select("id, item_id, quantity")
          .single();

        if (insertError) throw insertError;
        if (!insertedData) throw new Error("Failed to get inserted item data.");

        return {
          id: insertedData.id,
          itemId: insertedData.item_id,
          quantity: insertedData.quantity,
        };
      }
    } catch (error) {
      console.error("Error adding item to inventory:", error);
      return null;
    }
  }

  async equipItem(
    userId: string,
    petId: string,
    inventoryItemId: string,
    itemSlot: string,
  ): Promise<boolean> {
    try {
      await validateGameAction("item_equip", {
        petId,
        inventoryItemId,
        itemSlot,
      });

      // Start a transaction
      const { data, error } = await supabase.rpc("equip_item_transaction", {
        p_user_id: userId,
        p_pet_id: petId,
        p_inventory_item_id: inventoryItemId,
        p_item_slot: itemSlot,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error equipping item:", error);
      if (error.message && error.message.includes("Item not found")) {
        throw new Error(
          "Item not found in inventory or does not have quantity 1.",
        );
      }
      if (error.message && error.message.includes("Slot conflict")) {
        throw new Error(
          "Another item is already equipped in this slot by this pet.",
        );
      }
      return false;
    }
  }

  async unequipItem(
    userId: string,
    petId: string,
    inventoryItemId: string,
    itemSlot: string,
  ): Promise<boolean> {
    try {
      await validateGameAction("item_unequip", {
        petId,
        inventoryItemId,
        itemSlot,
      });

      const { data, error } = await supabase.rpc("unequip_item_transaction", {
        p_user_id: userId,
        p_pet_id: petId,
        p_inventory_item_id: inventoryItemId,
        p_item_slot: itemSlot,
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error unequipping item:", error);
      if (
        error.message &&
        error.message.includes("Item not equipped by this pet")
      ) {
        throw new Error(
          "Item not found or not equipped by this pet in the specified slot.",
        );
      }
      return false;
    }
  }

  // Item lookup operations
  async getItemByName(itemName: string): Promise<Item | null> {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("name", itemName)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        slug: data.name.toLowerCase().replace(/\s+/g, "-"),
        name: data.name,
        description: data.description,
        type: data.type,
        rarity: data.rarity,
        price: data.price,
        currency: data.currency,
        effects: data.effects || {},
        dailyLimit: data.daily_limit,
        decompositionTime: data.decomposition_hours,
        slot: data.slot,
        imageUrl: data.image_url,
        quantity: 1,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error("Error fetching item by name:", error);
      return null;
    }
  }

  async getItemById(itemId: string): Promise<Item | null> {
    try {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .eq("id", itemId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null;
        }
        throw error;
      }

      return {
        id: data.id,
        slug: data.name.toLowerCase().replace(/\s+/g, "-"),
        name: data.name,
        description: data.description,
        type: data.type,
        rarity: data.rarity,
        price: data.price,
        currency: data.currency,
        effects: data.effects || {},
        dailyLimit: data.daily_limit,
        decompositionTime: data.decomposition_hours,
        slot: data.slot,
        imageUrl: data.image_url,
        quantity: 1,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      console.error("Error fetching item by ID:", error);
      return null;
    }
  }

  // Enhanced player search operations
  async searchPlayers(query: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, account_score, created_at, last_login, is_admin, days_played, total_xenocoins",
        )
        .ilike("username", `%${query}%`)
        .limit(20);

      if (error) throw error;

      return data.map((profile) => ({
        id: profile.id,
        email: "",
        username: profile.username,
        isAdmin: profile.is_admin,
        language: "pt-BR",
        accountScore: profile.account_score,
        daysPlayed: profile.days_played,
        totalXenocoins: profile.total_xenocoins,
        createdAt: new Date(profile.created_at),
        lastLogin: new Date(profile.last_login),
      }));
    } catch (error) {
      console.error("Error searching players:", error);
      return [];
    }
  }

  async getPlayerProfile(userId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, username, account_score, created_at, last_login, is_admin, total_xenocoins, days_played",
        )
        .eq("id", userId)
        .single();

      if (error) throw error;

      // Get achievements count
      const { count: achievementsCount } = await supabase
        .from("user_achievements")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_unlocked", true);

      // Get collectibles count
      const { count: collectiblesCount } = await supabase
        .from("user_collectibles")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      return {
        id: data.id,
        email: "",
        username: data.username,
        isAdmin: data.is_admin,
        language: "pt-BR",
        accountScore: data.account_score,
        daysPlayed: data.days_played,
        totalXenocoins: data.total_xenocoins,
        createdAt: new Date(data.created_at),
        lastLogin: new Date(data.last_login),
        unlockedAchievementsCount: achievementsCount || 0,
        collectedCollectiblesCount: collectiblesCount || 0,
      };
    } catch (error) {
      console.error("Error fetching player profile:", error);
      return null;
    }
  }

  // Enhanced user achievements operations
  async getUserAchievements(userId: string): Promise<Achievement[]> {
    try {
      const { data, error } = await supabase
        .from("achievements")
        .select(
          `
          *,
          user_achievements!left (
            progress,
            is_unlocked,
            unlocked_at
          )
        `,
        )
        .eq("user_achievements.user_id", userId);

      if (error) throw error;

      return data.map((achievement) => ({
        id: achievement.id,
        name: achievement.name,
        description: achievement.description,
        category: achievement.category,
        requirements: achievement.requirements,
        rewards: achievement.rewards,
        maxProgress: achievement.max_progress,
        isUnlocked: achievement.user_achievements?.[0]?.is_unlocked || false,
        unlockedAt: achievement.user_achievements?.[0]?.unlocked_at
          ? new Date(achievement.user_achievements[0].unlocked_at)
          : undefined,
        progress: achievement.user_achievements?.[0]?.progress || 0,
      }));
    } catch (error) {
      console.error("Error fetching user achievements:", error);
      return [];
    }
  }

  // Enhanced user collectibles operations
  async getUserCollectedCollectibles(userId: string): Promise<Collectible[]> {
    try {
      const { data, error } = await supabase
        .from("user_collectibles")
        .select(
          `
          collected_at,
          collectibles (*)
        `,
        )
        .eq("user_id", userId);

      if (error) throw error;

      return data.map((userCollectible) => ({
        id: userCollectible.collectibles.id,
        name: userCollectible.collectibles.name,
        type: userCollectible.collectibles.type,
        rarity: userCollectible.collectibles.rarity,
        description: userCollectible.collectibles.description,
        imageUrl: userCollectible.collectibles.image_url,
        isCollected: true,
        collectedAt: new Date(userCollectible.collected_at),
        accountPoints: 1,
        obtainMethod: "Collected by user",
      }));
    } catch (error) {
      console.error("Error fetching user collected collectibles:", error);
      return [];
    }
  }

  // Enhanced collectibles operations
  async addUserCollectible(
    userId: string,
    collectibleName: string,
  ): Promise<boolean> {
    try {
      // First, find the collectible by name
      const { data: collectible, error: collectibleError } = await supabase
        .from("collectibles")
        .select("id")
        .eq("name", collectibleName)
        .single();

      if (collectibleError) {
        console.error("Error finding collectible:", collectibleError);
        return false;
      }

      // Add to user_collectibles
      const { error: insertError } = await supabase
        .from("user_collectibles")
        .insert({
          user_id: userId,
          collectible_id: collectible.id,
        });

      if (insertError) {
        // Check if it's a duplicate key error (user already has this collectible)
        if (insertError.code === "23505") {
          console.log("User already has this collectible");
          return true;
        }
        throw insertError;
      }

      return true;
    } catch (error) {
      console.error("Error adding user collectible:", error);
      return false;
    }
  }

  // Enhanced notifications
  async getUserNotifications(userId: string): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      return data.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        isRead: notification.is_read,
        actionUrl: notification.action_url,
        createdAt: new Date(notification.created_at),
      }));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  async addNotification(
    userId: string,
    notification: Omit<Notification, "id" | "createdAt">,
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from("notifications").insert({
        user_id: userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        action_url: notification.actionUrl,
      });

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error adding notification:", error);
      return false;
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return false;
    }
  }

  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error("Error deleting notification:", error);
      return false;
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);

      if (error) throw error;

      return true;
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      return false;
    }
  }

  // Helper methods
  private mapDatabasePetToPet(dbPet: any): Pet {
    return {
      id: dbPet.id,
      name: dbPet.name,
      species: dbPet.species,
      style: dbPet.style,
      level: dbPet.level,
      ownerId: dbPet.owner_id,
      happiness: dbPet.happiness,
      health: dbPet.health,
      hunger: dbPet.hunger,
      strength: dbPet.strength,
      dexterity: dbPet.dexterity,
      intelligence: dbPet.intelligence,
      speed: dbPet.speed,
      attack: dbPet.attack,
      defense: dbPet.defense,
      precision: dbPet.precision,
      evasion: dbPet.evasion,
      luck: dbPet.luck,
      personality: dbPet.personality,
      conditions: [],
      equipment: {},
      imageUrl: dbPet.image_url,
      isAlive: dbPet.is_alive,
      hatchTime: dbPet.hatch_time ? new Date(dbPet.hatch_time) : undefined,
      deathDate: dbPet.death_date ? new Date(dbPet.death_date) : undefined,
      lastInteraction: new Date(dbPet.last_interaction),
      createdAt: new Date(dbPet.created_at),
      updatedAt: new Date(dbPet.updated_at),
    };
  }
}

export const gameService = GameService.getInstance();
