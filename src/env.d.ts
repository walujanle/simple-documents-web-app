/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    user?: {
      id: string;
      username: string;
    };
  }
}
