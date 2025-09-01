#!/usr/bin/env tsx

/**
 * Standalone WebSocket test for respawn functionality
 * Tests the server-side respawn system by simulating player death and monitoring respawn
 */

import WebSocket from 'ws';
import { logger } from '../setup/serverLogger';

// Test configuration constants
const DEATH_CHECK_MAX = 10; // Maximum iterations to check for player death
const RESPAWN_TIMEOUT_MAX = 100; // Maximum iterations to wait for respawn completion
const CONNECTION_TIMEOUT_MS = 5000; // Connection timeout in milliseconds
const CHECK_INTERVAL_MS = 100; // Interval between state checks in milliseconds

interface GameState {
  players: Array<{
    id: string;
    name: string;
    health: number;
    exploding: boolean;
    respawnTimer?: number;
    position: { x: number; y: number };
  }>;
  gameTime: number;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

class RespawnTester {
  private ws: WebSocket | null = null;
  private testPlayerId: string;
  private gameStates: GameState[] = [];
  private testResults: TestResult[] = [];

  constructor() {
    this.testPlayerId = `test-player-${Date.now()}`;
  }

  async runTests(): Promise<{ success: boolean; failed: number; total: number }> {
    logger.info('🧪 Starting respawn functionality tests...');
    
    try {
      await this.connectToServer();
      await this.joinGame();
      await this.testPlayerDeath();
      await this.monitorRespawn();
      await this.validateRespawn();
      this.printResults();
    } catch (error) {
      logger.error('❌ Test failed:', error);
      this.testResults.push({
        success: false,
        message: 'Test execution failed',
        details: error instanceof Error ? error.message : String(error)
      });
    } finally {
      this.disconnect();
    }

    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    const failed = total - passed;

    return {
      success: failed === 0,
      failed,
      total
    };
  }

  private async connectToServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('ws://localhost:3001/ws');
      
      this.ws.on('open', () => {
        logger.info('✅ Connected to server');
        resolve();
      });
      
      this.ws.on('error', (error) => {
        logger.error('❌ WebSocket connection failed:', error);
        reject(error);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        // Clean up WebSocket before rejecting
        if (this.ws) {
          this.ws.removeAllListeners();
          this.ws.close();
          this.ws = null;
        }
        reject(new Error('Connection timeout'));
      }, CONNECTION_TIMEOUT_MS);
      
      // Store timeout ID so other resolution paths can clear it
      this.ws.on('open', () => {
        clearTimeout(timeoutId);
      });
    });
  }

  private async joinGame(): Promise<void> {
    return new Promise((resolve) => {
      const joinMessage = {
        type: 'join',
        id: this.testPlayerId,
        data: { name: 'RespawnTester' }
      };
      
      this.ws!.send(JSON.stringify(joinMessage));
      
      // Wait for joined confirmation
      const checkJoined = () => {
        if (this.gameStates.length > 0) {
          const player = this.gameStates[this.gameStates.length - 1].players.find(p => p.id === this.testPlayerId);
          if (player) {
            logger.info('✅ Player joined successfully');
            resolve();
            return;
          }
        }
        setTimeout(checkJoined, CHECK_INTERVAL_MS);
      };
      checkJoined();
    });
  }

  private async testPlayerDeath(): Promise<void> {
    logger.info('🧪 Testing player death...');
    
    // Send damage to kill the player
    const damageMessage = {
      type: 'laserDamage',
      data: {
        targetPlayerId: this.testPlayerId,
        attackerId: 'test-attacker',
        damage: 100
      }
    };
    
    this.ws!.send(JSON.stringify(damageMessage));
    
    // Wait for death state
    await new Promise<void>((resolve) => {
      const checkDeath = () => {
        const latestState = this.gameStates[this.gameStates.length - 1];
        const player = latestState.players.find(p => p.id === this.testPlayerId);
        
        if (player && player.health === 0 && player.exploding) {
          logger.info('✅ Player died successfully');
          this.testResults.push({
            success: true,
            message: 'Player death detected',
            details: { health: player.health, exploding: player.exploding }
          });
          resolve();
          return;
        }
        
        if (this.gameStates.length > DEATH_CHECK_MAX) {
          this.testResults.push({
            success: false,
            message: 'Player death not detected within timeout'
          });
          resolve();
          return;
        }
        
        setTimeout(checkDeath, CHECK_INTERVAL_MS);
      };
      checkDeath();
    });
  }

  private async monitorRespawn(): Promise<void> {
    logger.info('🧪 Monitoring respawn process...');
    
    return new Promise<void>((resolve) => {
      let respawnTimerSeen = false;
      let respawnCompleted = false;
      
      const checkRespawn = () => {
        const latestState = this.gameStates[this.gameStates.length - 1];
        const player = latestState.players.find(p => p.id === this.testPlayerId);
        
        if (player) {
          // Check if respawn timer was set
          if (player.respawnTimer !== undefined && !respawnTimerSeen) {
            logger.info(`✅ Respawn timer set: ${player.respawnTimer}`);
            respawnTimerSeen = true;
            this.testResults.push({
              success: true,
              message: 'Respawn timer set correctly',
              details: { respawnTimer: player.respawnTimer }
            });
          }
          
          // Check if respawn completed
          if (respawnTimerSeen && player.health === 100 && !player.exploding && player.respawnTimer === undefined && !respawnCompleted) {
            logger.info('✅ Player respawned successfully');
            respawnCompleted = true;
            this.testResults.push({
              success: true,
              message: 'Player respawn completed',
              details: { 
                health: player.health, 
                exploding: player.exploding, 
                position: player.position 
              }
            });
            resolve();
            return;
          }
        }
        
        // Timeout after 10 seconds
        if (this.gameStates.length > RESPAWN_TIMEOUT_MAX) {
          this.testResults.push({
            success: false,
            message: 'Respawn not completed within timeout'
          });
          resolve();
          return;
        }
        
        setTimeout(checkRespawn, CHECK_INTERVAL_MS);
      };
      checkRespawn();
    });
  }

  private async validateRespawn(): Promise<void> {
    logger.info('🧪 Validating respawn results...');
    
    const latestState = this.gameStates[this.gameStates.length - 1];
    const player = latestState.players.find(p => p.id === this.testPlayerId);
    
    if (player) {
      // Validate final state
      const validations = [
        {
          name: 'Health restored',
          condition: player.health === 100,
          expected: 100,
          actual: player.health
        },
        {
          name: 'Exploding state cleared',
          condition: !player.exploding,
          expected: false,
          actual: player.exploding
        },
        {
          name: 'Respawn timer cleared',
          condition: player.respawnTimer === undefined,
          expected: undefined,
          actual: player.respawnTimer
        },
        {
          name: 'Position changed',
          condition: player.position.x !== 0 || player.position.y !== 0,
          expected: 'non-zero position',
          actual: player.position
        }
      ];
      
      validations.forEach(validation => {
        this.testResults.push({
          success: validation.condition,
          message: validation.name,
          details: { expected: validation.expected, actual: validation.actual }
        });
      });
    }
  }

  private handleMessage(message: any): void {
    if (message.type === 'gameState') {
      this.gameStates.push(message.data);
    }
  }

  private printResults(): void {
    logger.info('\n📊 Respawn Test Results:');
    logger.info('========================');
    
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      logger.info(`${status} Test ${index + 1}: ${result.message}`);
      if (result.details) {
        logger.info(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
    });
    
    logger.info(`\n📈 Summary: ${passed}/${total} tests passed`);
    
    if (passed === total) {
      logger.info('🎉 All respawn tests passed!');
    } else {
      logger.error('💥 Some respawn tests failed!');
    }
  }

  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      logger.info('🔌 Disconnected from server');
    }
  }
}

// Run the tests
async function main(): Promise<void> {
  const tester = new RespawnTester();
  await tester.runTests();
}

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Test runner failed:', error);
    process.exit(1);
  });
}

export { RespawnTester };
