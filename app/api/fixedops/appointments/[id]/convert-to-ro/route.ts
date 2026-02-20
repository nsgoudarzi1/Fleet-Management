import { NextResponse } from "next/server";
import { convertAppointmentToRepairOrder } from "@/lib/services/fixedops";
import { handleRouteError } from "@/lib/services/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const data = await convertAppointmentToRepairOrder({
      ...body,
      appointmentId: id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleRouteError(error);
  }
}
