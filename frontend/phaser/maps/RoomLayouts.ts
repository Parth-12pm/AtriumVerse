// Room layout type definitions
export interface RoomLayout {
  id: string;
  name: string;
  type: 'hall' | 'meeting' | 'office';
  width: number;
  height: number;
  backgroundColor: number;
  walls: WallDefinition[];
  doors: DoorDefinition[];
  furniture: FurnitureDefinition[];
  proximityRange: number; // in pixels
  spawnPoint: { x: number; y: number };
}

export interface WallDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DoorDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
  targetRoomId: string;
  targetSpawnPoint: { x: number; y: number };
  isLocked: boolean;
  requiresPassword: boolean;
}

export interface FurnitureDefinition {
  id: string;
  type: 'desk' | 'table' | 'chair' | 'podium' | 'whiteboard';
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  collidable: boolean;
}

// Three room templates
export const ROOM_TEMPLATES: Record<string, RoomLayout> = {
  hall: {
    id: 'hall',
    name: 'Main Hall',
    type: 'hall',
    width: 800,
    height: 600,
    backgroundColor: 0xe8f4f8, // Light blue
    proximityRange: 200, // Large range for open space
    spawnPoint: { x: 400, y: 300 },
    
    // Minimal walls - just outer boundary
    walls: [
      // Top wall
      { x: 0, y: 0, width: 800, height: 20 },
      // Bottom wall
      { x: 0, y: 580, width: 800, height: 20 },
      // Left wall
      { x: 0, y: 0, width: 20, height: 600 },
      // Right wall (with gap for door to meeting room)
      { x: 780, y: 0, width: 20, height: 250 },
      { x: 780, y: 350, width: 20, height: 250 },
    ],
    
    doors: [
      {
        x: 780,
        y: 250,
        width: 10,  // Thin door hitbox (was 20px)
        height: 100,
        targetRoomId: 'meeting',
        targetSpawnPoint: { x: 50, y: 400 },
        isLocked: false,
        requiresPassword: false,
      },
    ],
    
    furniture: [
      // Reception desk
      { id: 'reception', type: 'desk', x: 100, y: 100, width: 80, height: 40, color: 0x8b4513, collidable: true },
      // Lounge tables
      { id: 'table1', type: 'table', x: 400, y: 400, width: 100, height: 60, color: 0xd2691e, collidable: true },
      { id: 'table2', type: 'table', x: 600, y: 200, width: 100, height: 60, color: 0xd2691e, collidable: true },
    ],
  },

  meeting: {
    id: 'meeting',
    name: 'Conference Room',
    type: 'meeting',
    width: 1200,
    height: 800,
    backgroundColor: 0xfff8dc, // Cornsilk
    proximityRange: 150, // Medium range
    spawnPoint: { x: 600, y: 400 },
    
    walls: [
      // Outer boundary
      { x: 0, y: 0, width: 1200, height: 20 },
      { x: 0, y: 780, width: 1200, height: 20 },
      { x: 0, y: 0, width: 20, height: 800 },
      
      // Right wall with door to hall
      { x: 1180, y: 0, width: 20, height: 350 },
      { x: 1180, y: 450, width: 20, height: 350 },
      
      // Door to office (bottom wall)
      { x: 0, y: 0, width: 20, height: 350 },
      { x: 0, y: 450, width: 20, height: 350 },
    ],
    
    doors: [
      {
        x: 1180,
        y: 350,
        width: 10,  // Thin door
        height: 100,
        targetRoomId: 'hall',
        targetSpawnPoint: { x: 750, y: 300 },
        isLocked: false,
        requiresPassword: false,
      },
      {
        x: 0,
        y: 350,
        width: 10,  // Thin door
        height: 100,
        targetRoomId: 'office',
        targetSpawnPoint: { x: 950, y: 350 },
        isLocked: false,
        requiresPassword: false,
      },
    ],
    
    furniture: [
      // Large conference table in center
      { id: 'conf_table', type: 'table', x: 500, y: 350, width: 200, height: 100, color: 0x654321, collidable: true },
      // Podium at front
      { id: 'podium', type: 'podium', x: 600, y: 150, width: 60, height: 60, color: 0x8b4513, collidable: true },
      // Whiteboard
      { id: 'whiteboard', type: 'whiteboard', x: 550, y: 50, width: 100, height: 10, color: 0xffffff, collidable: false },
    ],
  },

  office: {
    id: 'office',
    name: 'Office Workspace',
    type: 'office',
    width: 1000,
    height: 700,
    backgroundColor: 0xf0f0f0, // Light gray
    proximityRange: 100, // Small range for focused work
    spawnPoint: { x: 500, y: 350 },
    
    walls: [
      // Outer boundary
      { x: 0, y: 0, width: 1000, height: 20 },
      { x: 0, y: 680, width: 1000, height: 20 },
      { x: 0, y: 0, width: 20, height: 700 },
      
      // Right wall with door to meeting
      { x: 980, y: 0, width: 20, height: 300 },
      { x: 980, y: 400, width: 20, height: 300 },
      
      // Cubicle dividers (interior walls)
      { x: 150, y: 100, width: 10, height: 150 },
      { x: 350, y: 100, width: 10, height: 150 },
      { x: 550, y: 100, width: 10, height: 150 },
      
      { x: 150, y: 450, width: 10, height: 150 },
      { x: 350, y: 450, width: 10, height: 150 },
      { x: 550, y: 450, width: 10, height: 150 },
    ],
    
    doors: [
      {
        x: 980,
        y: 300,
        width: 10,  // Thin door
        height: 100,
        targetRoomId: 'meeting',
        targetSpawnPoint: { x: 50, y: 400 },
        isLocked: false,
        requiresPassword: false,
      },
    ],
    
    furniture: [
      // Desks in cubicles
      { id: 'desk1', type: 'desk', x: 200, y: 150, width: 80, height: 50, color: 0x8b4513, collidable: true },
      { id: 'desk2', type: 'desk', x: 400, y: 150, width: 80, height: 50, color: 0x8b4513, collidable: true },
      { id: 'desk3', type: 'desk', x: 600, y: 150, width: 80, height: 50, color: 0x8b4513, collidable: true },
      
      { id: 'desk4', type: 'desk', x: 200, y: 500, width: 80, height: 50, color: 0x8b4513, collidable: true },
      { id: 'desk5', type: 'desk', x: 400, y: 500, width: 80, height: 50, color: 0x8b4513, collidable: true },
      { id: 'desk6', type: 'desk', x: 600, y: 500, width: 80, height: 50, color: 0x8b4513, collidable: true },
      
      // Chairs (non-collidable)
      { id: 'chair1', type: 'chair', x: 200, y: 210, width: 30, height: 30, color: 0x4169e1, collidable: false },
      { id: 'chair2', type: 'chair', x: 400, y: 210, width: 30, height: 30, color: 0x4169e1, collidable: false },
      { id: 'chair3', type: 'chair', x: 600, y: 210, width: 30, height: 30, color: 0x4169e1, collidable: false },
    ],
  },
};
