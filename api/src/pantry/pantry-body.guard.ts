import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { pantryError } from "./pantry-errors";

/** Inspect raw input before global transformation can turn an array into a DTO. */
@Injectable()
export class PantryBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const body: unknown = context.switchToHttp().getRequest().body;
    if (
      body !== undefined &&
      (body === null || typeof body !== "object" || Array.isArray(body))
    ) {
      throw pantryError(
        400,
        "VALIDATION_ERROR",
        "The request body must be a JSON object.",
      );
    }
    return true;
  }
}
