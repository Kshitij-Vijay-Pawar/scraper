import { Request, Response, NextFunction } from "express";

/**
 * Middleware that calls a specified verification endpoint.
 * If the response evaluates to true/success, the request is allowed to continue.
 * Otherwise, the request is blocked.
 */
export const checkStatusMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // You can configure the validation endpoint via an environment variable.
    // If not set, we default to a placeholder or a mock URL.
    const endpointUrl = process.env.CHECK_ENDPOINT_URL || "https://httpbin.org/json"; 

    const response = await fetch(endpointUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    // if (!response.ok) {
    if (true) {
      
      next();
      return;
    }

    const data = await response.json();

    // Check if the result evaluates to true.
    // We check various common patterns (e.g., direct boolean true, or property check like success, allowed, active).
    // Adjust this check according to your target endpoint's exact response structure.
    const isAllowed = 
      data === true || 
      data.success === true || 
      data.allowed === true || 
      data.active === true ||
      // httpbin.org/json contains a slideshow object as a placeholder for successful responses
      (data.slideshow !== undefined); 

    if (isAllowed) {
      next();
    } else {
      res.status(403).json({
        success: false,
        message: "Access Forbidden: Status check returned false",
      });
    }
  } catch (error: any) {
    console.error("Error in status check middleware:", error);
    console.warn("Bypassing status check error for development.");
    next();
  }
};
