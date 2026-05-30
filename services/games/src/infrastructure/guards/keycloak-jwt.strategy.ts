import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

export interface PayloadJwt {
  sub: string;
  preferred_username: string;
}

export interface UsuarioAutenticado {
  jogadorId: string;
  nomeUsuario: string;
}

@Injectable()
export class KeycloakJwtStrategy extends PassportStrategy(Strategy, 'keycloak-jwt') {
  constructor() {
    super({
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: `${process.env.KEYCLOAK_URL ?? 'http://keycloak:8080'}/realms/crash-game/protocol/openid-connect/certs`,
        cache: true,
        rateLimit: true,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ['RS256'],
      ignoreExpiration: false,
    });
  }

  validate(payload: PayloadJwt): UsuarioAutenticado {
    return {
      jogadorId: payload.sub,
      nomeUsuario: payload.preferred_username,
    };
  }
}
