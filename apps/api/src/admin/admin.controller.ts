import { Controller, Get } from "@nestjs/common";
import { AdminService } from "#admin/admin.service";
import { Authorize } from "#auth/decorators";

@Authorize("admin:open")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("overview")
  overview() {
    return this.adminService.overview();
  }
}
