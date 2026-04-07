export class Physics {
  private velocityY = 0;
  private grounded = false;

  constructor(
    private gravity: number = -0.00003,
    private terminalVelocity: number = -0.05,
    private jumpForce: number = 0.012,
  ) {}

  public update(deltaTime: number): number {
    if (this.grounded) {
      this.velocityY = 0;
      return 0;
    }
    this.velocityY += this.gravity * deltaTime;
    if (this.velocityY < this.terminalVelocity) {
      this.velocityY = this.terminalVelocity;
    }
    return this.velocityY * deltaTime;
  }

  public land() {
    if (this.velocityY < 0) {
      this.velocityY = 0;
    }
    this.grounded = true;
  }

  public jump() {
    if (this.grounded) {
      this.velocityY = this.jumpForce;
      this.grounded = false;
    }
  }

  public fall() {
    this.grounded = false;
  }

  public isGrounded() {
    return this.grounded;
  }

  public getVelocityY() {
    return this.velocityY;
  }

  public reset() {
    this.velocityY = 0;
    this.grounded = false;
  }
}
