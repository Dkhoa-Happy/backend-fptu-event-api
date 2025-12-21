import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'checkin',
  cors: true,
})
export class CheckinGateway {
  @WebSocketServer()
  server: Server;

  @SubscribeMessage('joinEvent')
  handleJoinEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.getEventRoom(data.eventId);
    client.join(room);
    return { joined: true, room };
  }

  @SubscribeMessage('leaveEvent')
  handleLeaveEvent(
    @MessageBody() data: { eventId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = this.getEventRoom(data.eventId);
    client.leave(room);
    return { left: true, room };
  }

  broadcastCheckin(eventId: string, payload: unknown) {
    const room = this.getEventRoom(eventId);
    this.server.to(room).emit('checkin', payload);
  }

  private getEventRoom(eventId: string) {
    return `event:${eventId}:checkin`;
  }
}
