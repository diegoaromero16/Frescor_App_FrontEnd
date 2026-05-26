import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { authGuard } from './core/guards/auth-guard';
import { adminGuard } from './core/guards/admin-guard';

export const routes: Routes = [
	{ path: '', component: LandingComponent },
	{
		path: 'pedido',
		loadComponent: () => import('./pages/pedido/pedido').then(m => m.Pedido)
	},
	{
		path: 'payment-result',
		loadComponent: () =>
			import('./pages/payment-result/payment-result').then(m => m.PaymentResultComponent)
	},
	{
		path: 'login',
		loadComponent: () =>
			import('./pages/auth/login/login').then(m => m.login)
	},
	{
		path: 'dashboard',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./pages/dashboard/dashboard').then(m => m.DashboardComponent)
	},
	{
		path: 'productos',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./pages/productos/productos').then(m => m.ProductosComponent)
	},
	{
		path: 'clientes',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./pages/clientes/clientes').then(m => m.ClientesComponent)
	},
	{
		path: 'cupones',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./pages/cupones/cupones').then(m => m.CuponesComponent)
	},
	{
		path: 'zonas',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./pages/zonas/zonas').then(m => m.ZonasComponent)
	},
	{
		path: 'deudas',
		canActivate: [adminGuard],
		loadComponent: () =>
			import('./pages/deudas/deudas').then(m => m.DeudasComponent)
	},
	{
		path: 'generar-boleta',
		canActivate: [authGuard],
		loadComponent: () =>
			import('./pages/generar-boleta/generar-boleta').then(m => m.GenerarBoletaComponent)
	},
	{
		path: '**',
		redirectTo: ''
	}
];