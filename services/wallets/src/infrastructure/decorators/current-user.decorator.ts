import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsuarioAutenticado } from '../guards/keycloak-jwt.strategy';

export const UsuarioAtual = createParamDecorator(
  (_dados: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const requisicao = ctx.switchToHttp().getRequest();
    return requisicao.user as UsuarioAutenticado;
  },
);
